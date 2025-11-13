// Daily Sales Service - Database version
// Provides data access functions for flat_sales_transactions table

import { query, queryOne } from '../lib/database'

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
 * Get filter options from database
 */
export const getFilterOptions = async () => {
  const [stores, products, users, regions, currencies, categories] = await Promise.all([
    // Stores
    query(`
      SELECT DISTINCT
        store_code as "storeCode",
        store_name as "storeName"
      FROM flat_sales_transactions
      WHERE store_code IS NOT NULL AND store_name IS NOT NULL
      ORDER BY store_name
      LIMIT 100
    `),
    // Products
    query(`
      SELECT DISTINCT
        product_code as "productCode",
        product_name as "productName",
        product_category as "productCategory"
      FROM flat_sales_transactions
      WHERE product_code IS NOT NULL AND product_name IS NOT NULL
      ORDER BY product_name
      LIMIT 100
    `),
    // Users
    query(`
      SELECT DISTINCT
        field_user_code as "userCode",
        field_user_name as "userName",
        user_type as "userType"
      FROM flat_sales_transactions
      WHERE field_user_code IS NOT NULL AND field_user_name IS NOT NULL
      ORDER BY field_user_name
      LIMIT 100
    `),
    // Regions
    query(`
      SELECT DISTINCT
        region_code as "regionCode",
        country_code as "countryCode",
        city_code as "cityCode"
      FROM flat_sales_transactions
      WHERE region_code IS NOT NULL
      ORDER BY region_code
      LIMIT 100
    `),
    // Currencies
    query(`
      SELECT DISTINCT currency_code as "currencyCode"
      FROM flat_sales_transactions
      WHERE currency_code IS NOT NULL
      ORDER BY currency_code
    `),
    // Categories
    query(`
      SELECT DISTINCT
        product_category as "productCategory",
        product_subcategory as "productSubcategory",
        product_group as "productGroup"
      FROM flat_sales_transactions
      WHERE product_category IS NOT NULL
      ORDER BY product_category
      LIMIT 50
    `)
  ])

  return {
    stores: stores.rows,
    products: products.rows,
    users: users.rows,
    regions: regions.rows,
    currencies: currencies.rows,
    categories: categories.rows
  }
}

/**
 * Get daily sales summary with filters
 */
export const getDailySalesSummary = async (filters: any = {}) => {
  const { startDate, endDate } = filters.startDate && filters.endDate
    ? { startDate: new Date(filters.startDate), endDate: new Date(filters.endDate) }
    : filters.dateRange
    ? getDateRangeFromString(filters.dateRange)
    : getDateRangeFromString('last7days')

  const startDateStr = startDate.toISOString().split('T')[0]
  const endDateStr = endDate.toISOString().split('T')[0]

  let sql = `
    SELECT
      COUNT(DISTINCT trx_code) as total_orders,
      COUNT(DISTINCT store_code) as total_stores,
      COUNT(DISTINCT product_code) as total_products,
      COUNT(DISTINCT field_user_code) as total_users,
      COALESCE(SUM(quantity), 0) as total_quantity,
      COALESCE(SUM(line_amount), 0) as total_sales,
      COALESCE(SUM(discount_amount), 0) as total_discount,
      COALESCE(SUM(net_amount), 0) as total_net_sales,
      COALESCE(AVG(net_amount), 0) as avg_order_value,
      (SELECT currency_code FROM flat_sales_transactions WHERE currency_code IS NOT NULL LIMIT 1) as currency_code
    FROM flat_sales_transactions
    WHERE trx_date_only >= $1 AND trx_date_only <= $2
  `

  const params: any[] = [startDateStr, endDateStr]
  let paramCount = 3

  // Apply filters
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
    sql += ` AND COALESCE(user_role, 'Field User') = $${paramCount}`
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
  
  // Hierarchy filter - apply if allowedUserCodes is provided
  if (filters.allowedUserCodes && Array.isArray(filters.allowedUserCodes) && filters.allowedUserCodes.length > 0) {
    const placeholders = filters.allowedUserCodes.map((_: any, index: number) => `$${paramCount + index}`).join(', ')
    sql += ` AND field_user_code IN (${placeholders})`
    params.push(...filters.allowedUserCodes)
    paramCount += filters.allowedUserCodes.length
  }

  const result = await query(sql, params)
  const stats = result.rows[0]

  return {
    totalOrders: parseInt(stats.total_orders) || 0,
    totalStores: parseInt(stats.total_stores) || 0,
    totalProducts: parseInt(stats.total_products) || 0,
    totalUsers: parseInt(stats.total_users) || 0,
    totalQuantity: parseFloat(stats.total_quantity) || 0,
    totalSales: parseFloat(stats.total_sales) || 0,
    totalDiscount: parseFloat(stats.total_discount) || 0,
    totalNetSales: parseFloat(stats.total_net_sales) || 0,
    avgOrderValue: parseFloat(stats.avg_order_value) || 0,
    currencyCode: stats.currency_code || 'INR'
  }
}

/**
 * Get daily sales trend
 */
export const getDailyTrend = async (filters: any = {}) => {
  const { startDate, endDate } = filters.startDate && filters.endDate
    ? { startDate: new Date(filters.startDate), endDate: new Date(filters.endDate) }
    : filters.dateRange
    ? getDateRangeFromString(filters.dateRange)
    : getDateRangeFromString('last7days')

  const startDateStr = startDate.toISOString().split('T')[0]
  const endDateStr = endDate.toISOString().split('T')[0]

  let sql = `
    SELECT
      trx_date_only as date,
      COUNT(DISTINCT trx_code) as orders,
      COALESCE(SUM(quantity), 0) as quantity,
      COALESCE(SUM(net_amount), 0) as sales,
      COUNT(DISTINCT store_code) as stores,
      COUNT(DISTINCT store_code) as customers,
      COUNT(DISTINCT product_code) as products
    FROM flat_sales_transactions
    WHERE trx_date_only >= $1 AND trx_date_only <= $2
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
    sql += ` AND COALESCE(user_role, 'Field User') = $${paramCount}`
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
  
  // Hierarchy filter - apply if allowedUserCodes is provided
  if (filters.allowedUserCodes && Array.isArray(filters.allowedUserCodes) && filters.allowedUserCodes.length > 0) {
    const placeholders = filters.allowedUserCodes.map((_: any, index: number) => `$${paramCount + index}`).join(', ')
    sql += ` AND field_user_code IN (${placeholders})`
    params.push(...filters.allowedUserCodes)
    paramCount += filters.allowedUserCodes.length
  }

  sql += ` GROUP BY trx_date_only ORDER BY trx_date_only`

  const result = await query(sql, params)

  return result.rows.map((row: any) => ({
    date: row.date,
    orders: parseInt(row.orders),
    quantity: parseFloat(row.quantity),
    sales: parseFloat(row.sales),
    stores: parseInt(row.stores),
    customers: parseInt(row.customers),
    products: parseInt(row.products)
  }))
}

/**
 * Get product performance
 */
export const getProductPerformance = async (filters: any = {}) => {
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
      product_subcategory as "productSubcategory",
      product_group as "productGroup",
      product_base_uom as "productUom",
      COUNT(DISTINCT trx_code) as orders,
      COUNT(DISTINCT store_code) as stores,
      COALESCE(SUM(quantity), 0) as quantity,
      COALESCE(SUM(line_amount), 0) as sales,
      COALESCE(SUM(discount_amount), 0) as discount,
      COALESCE(SUM(net_amount), 0) as net_sales,
      COALESCE(AVG(unit_price), 0) as avg_price
    FROM flat_sales_transactions
    WHERE trx_date_only >= $1 AND trx_date_only <= $2
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
    sql += ` AND COALESCE(user_role, 'Field User') = $${paramCount}`
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
  
  // Hierarchy filter - apply if allowedUserCodes is provided
  if (filters.allowedUserCodes && Array.isArray(filters.allowedUserCodes) && filters.allowedUserCodes.length > 0) {
    const placeholders = filters.allowedUserCodes.map((_: any, index: number) => `$${paramCount + index}`).join(', ')
    sql += ` AND field_user_code IN (${placeholders})`
    params.push(...filters.allowedUserCodes)
    paramCount += filters.allowedUserCodes.length
  }

  sql += `
    GROUP BY product_code, product_name, product_category, product_subcategory, product_group, product_base_uom
    ORDER BY net_sales DESC
    LIMIT 100
  `

  const result = await query(sql, params)

  return result.rows.map((row: any) => ({
    productCode: row.productCode,
    productName: row.productName,
    productCategory: row.productCategory,
    productSubcategory: row.productSubcategory,
    productGroup: row.productGroup,
    productUom: row.productUom,
    orders: parseInt(row.orders),
    stores: parseInt(row.stores),
    quantity: parseFloat(row.quantity),
    sales: parseFloat(row.sales),
    discount: parseFloat(row.discount),
    netSales: parseFloat(row.net_sales),
    avgPrice: parseFloat(row.avg_price)
  }))
}

/**
 * Get store performance
 */
export const getStorePerformance = async (filters: any = {}) => {
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
      store_classification as "storeClass",
      city_code as "cityCode",
      region_code as "regionCode",
      country_code as "countryCode",
      COUNT(DISTINCT trx_code) as orders,
      COUNT(DISTINCT product_code) as products,
      COUNT(DISTINCT field_user_code) as users,
      COALESCE(SUM(quantity), 0) as quantity,
      COALESCE(SUM(line_amount), 0) as sales,
      COALESCE(SUM(discount_amount), 0) as discount,
      COALESCE(SUM(net_amount), 0) as net_sales,
      COALESCE(AVG(net_amount), 0) as avg_order_value
    FROM flat_sales_transactions
    WHERE trx_date_only >= $1 AND trx_date_only <= $2
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
    sql += ` AND COALESCE(user_role, 'Field User') = $${paramCount}`
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
  
  // Hierarchy filter - apply if allowedUserCodes is provided
  if (filters.allowedUserCodes && Array.isArray(filters.allowedUserCodes) && filters.allowedUserCodes.length > 0) {
    const placeholders = filters.allowedUserCodes.map((_: any, index: number) => `$${paramCount + index}`).join(', ')
    sql += ` AND field_user_code IN (${placeholders})`
    params.push(...filters.allowedUserCodes)
    paramCount += filters.allowedUserCodes.length
  }

  sql += `
    GROUP BY store_code, store_name, store_classification, city_code, region_code, country_code
    ORDER BY net_sales DESC
    LIMIT 100
  `

  const result = await query(sql, params)

  return result.rows.map((row: any) => ({
    storeCode: row.storeCode,
    storeName: row.storeName,
    storeClass: row.storeClass,
    cityCode: row.cityCode,
    regionCode: row.regionCode,
    countryCode: row.countryCode,
    orders: parseInt(row.orders),
    products: parseInt(row.products),
    users: parseInt(row.users),
    quantity: parseFloat(row.quantity),
    sales: parseFloat(row.sales),
    discount: parseFloat(row.discount),
    netSales: parseFloat(row.net_sales),
    avgOrderValue: parseFloat(row.avg_order_value)
  }))
}

/**
 * Get user/field rep performance
 */
export const getUserPerformance = async (filters: any = {}) => {
  const { startDate, endDate } = filters.startDate && filters.endDate
    ? { startDate: new Date(filters.startDate), endDate: new Date(filters.endDate) }
    : filters.dateRange
    ? getDateRangeFromString(filters.dateRange)
    : getDateRangeFromString('last7days')

  const startDateStr = startDate.toISOString().split('T')[0]
  const endDateStr = endDate.toISOString().split('T')[0]

  let sql = `
    SELECT
      field_user_code as "userCode",
      field_user_name as "userName",
      user_type as "userType",
      COUNT(DISTINCT trx_code) as orders,
      COUNT(DISTINCT store_code) as stores,
      COUNT(DISTINCT product_code) as products,
      COALESCE(SUM(quantity), 0) as quantity,
      COALESCE(SUM(line_amount), 0) as sales,
      COALESCE(SUM(discount_amount), 0) as discount,
      COALESCE(SUM(net_amount), 0) as net_sales,
      COALESCE(AVG(net_amount), 0) as avg_order_value
    FROM flat_sales_transactions
    WHERE trx_date_only >= $1 AND trx_date_only <= $2
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
    sql += ` AND COALESCE(user_role, 'Field User') = $${paramCount}`
    params.push(filters.fieldUserRole)
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
  
  // Hierarchy filter - apply if allowedUserCodes is provided
  if (filters.allowedUserCodes && Array.isArray(filters.allowedUserCodes) && filters.allowedUserCodes.length > 0) {
    const placeholders = filters.allowedUserCodes.map((_: any, index: number) => `$${paramCount + index}`).join(', ')
    sql += ` AND field_user_code IN (${placeholders})`
    params.push(...filters.allowedUserCodes)
    paramCount += filters.allowedUserCodes.length
  }

  sql += `
    GROUP BY field_user_code, field_user_name, user_type
    ORDER BY net_sales DESC
    LIMIT 100
  `

  const result = await query(sql, params)

  return result.rows.map((row: any) => ({
    userCode: row.userCode,
    userName: row.userName,
    userType: row.userType,
    orders: parseInt(row.orders),
    stores: parseInt(row.stores),
    products: parseInt(row.products),
    quantity: parseFloat(row.quantity),
    sales: parseFloat(row.sales),
    discount: parseFloat(row.discount),
    netSales: parseFloat(row.net_sales),
    avgOrderValue: parseFloat(row.avg_order_value)
  }))
}

/**
 * Get transaction details
 */
export const getTransactionDetails = async (filters: any = {}) => {
  const { startDate, endDate } = filters.startDate && filters.endDate
    ? { startDate: new Date(filters.startDate), endDate: new Date(filters.endDate) }
    : filters.dateRange
    ? getDateRangeFromString(filters.dateRange)
    : getDateRangeFromString('last7days')

  const startDateStr = startDate.toISOString().split('T')[0]
  const endDateStr = endDate.toISOString().split('T')[0]

  let sql = `
    SELECT
      trx_code as "trxCode",
      trx_date as "trxDate",
      trx_date_only as "trxDateOnly",
      field_user_code as "fieldUserCode",
      field_user_name as "fieldUserName",
      COALESCE(user_role, 'Field User') as "fieldUserRole",
      tl_code as "tlCode",
      tl_name as "tlName",
      region_code as "regionCode",
      city_code as "cityCode",
      store_code as "storeCode",
      store_name as "storeName",
      product_code as "productCode",
      product_name as "productName",
      product_category as "productCategory",
      quantity,
      unit_price as "unitPrice",
      line_amount as "lineAmount",
      payment_type as "paymentType",
      trx_status as "trxStatus"
    FROM flat_sales_transactions
    WHERE trx_date_only >= $1 AND trx_date_only <= $2
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
    sql += ` AND COALESCE(user_role, 'Field User') = $${paramCount}`
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
  
  // Hierarchy filter - apply if allowedUserCodes is provided
  if (filters.allowedUserCodes && Array.isArray(filters.allowedUserCodes) && filters.allowedUserCodes.length > 0) {
    const placeholders = filters.allowedUserCodes.map((_: any, index: number) => `$${paramCount + index}`).join(', ')
    sql += ` AND field_user_code IN (${placeholders})`
    params.push(...filters.allowedUserCodes)
    paramCount += filters.allowedUserCodes.length
  }

  sql += ` ORDER BY trx_date DESC, trx_code`

  const result = await query(sql, params)

  return result.rows.map((row: any) => ({
    trxCode: row.trxCode,
    trxDate: row.trxDate,
    trxDateOnly: row.trxDateOnly,
    fieldUserCode: row.fieldUserCode,
    fieldUserName: row.fieldUserName,
    fieldUserRole: row.fieldUserRole,
    tlCode: row.tlCode,
    tlName: row.tlName,
    regionCode: row.regionCode,
    cityCode: row.cityCode,
    storeCode: row.storeCode,
    storeName: row.storeName,
    productCode: row.productCode,
    productName: row.productName,
    productCategory: row.productCategory,
    quantity: parseFloat(row.quantity),
    unitPrice: parseFloat(row.unitPrice),
    lineAmount: parseFloat(row.lineAmount),
    paymentType: row.paymentType,
    trxStatus: row.trxStatus
  }))
}

export const dailySalesService = {
  getFilterOptions,
  getDailySalesSummary,
  getDailyTrend,
  getProductPerformance,
  getStorePerformance,
  getUserPerformance,
  getTransactionDetails
}

export default dailySalesService
