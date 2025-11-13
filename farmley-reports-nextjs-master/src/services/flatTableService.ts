// Flat Tables Query Service - PostgreSQL Flat Tables
// Optimized queries for reporting using denormalized flat tables

import { db } from '@/lib/database'
import type {
  FlatSalesTransaction,
  FlatStockCheck,
  FlatStoreVisit,
  FlatAttendanceDaily,
  FlatCompetitorObservation,
  FlatTarget,
  DateRangeFilter,
  SalesFilters,
  AttendanceFilters,
  VisitFilters,
  TargetFilters,
  CompetitionFilters,
  DailySalesSummary,
  ProductPerformance,
  StorePerformance,
  UserPerformance,
  AttendanceSummary,
  DailyTrend,
  FilterOptions
} from '@/types/flatTables'

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function buildDateFilter(column: string, startDate?: string, endDate?: string): { clause: string; params: any[]; index: number } {
  const clauses: string[] = []
  const params: any[] = []
  let index = 1

  if (startDate) {
    clauses.push(`${column} >= $${index++}`)
    params.push(startDate)
  }
  if (endDate) {
    clauses.push(`${column} <= $${index++}`)
    params.push(endDate)
  }

  return { clause: clauses.join(' AND '), params, index }
}

function formatCurrency(amount: number, currency: string = 'AED'): string {
  return `${currency} ${amount.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

// ============================================================================
// DAILY SALES REPORT QUERIES
// ============================================================================

export async function getDailySalesSummary(filters: SalesFilters): Promise<DailySalesSummary> {
  const dateFilter = buildDateFilter('trx_date_only', filters.startDate, filters.endDate)
  let paramIndex = dateFilter.index

  const conditions: string[] = [dateFilter.clause]
  const params = [...dateFilter.params]

  if (filters.userCode) {
    conditions.push(`field_user_code = $${paramIndex++}`)
    params.push(filters.userCode)
  }
  if (filters.storeCode) {
    conditions.push(`store_code = $${paramIndex++}`)
    params.push(filters.storeCode)
  }
  if (filters.productCode) {
    conditions.push(`product_code = $${paramIndex++}`)
    params.push(filters.productCode)
  }
  if (filters.productCategory) {
    conditions.push(`product_group_level1 = $${paramIndex++}`)
    params.push(filters.productCategory)
  }
  if (filters.regionCode) {
    conditions.push(`store_region_code = $${paramIndex++}`)
    params.push(filters.regionCode)
  }
  if (filters.storeClassification) {
    conditions.push(`store_classification = $${paramIndex++}`)
    params.push(filters.storeClassification)
  }

  const whereClause = conditions.filter(c => c).join(' AND ')

  const query = `
    SELECT
      SUM(CASE WHEN trx_type = 'Sales' THEN unit_price * quantity ELSE 0 END) as total_sales,
      SUM(CASE WHEN trx_type = 'Sales' THEN net_amount ELSE 0 END) as total_net_sales,
      SUM(CASE WHEN trx_type = 'Sales' THEN total_discount_amount ELSE 0 END) as total_discount,
      COUNT(DISTINCT CASE WHEN trx_type = 'Sales' THEN trx_code END) as total_orders,
      SUM(CASE WHEN trx_type = 'Sales' THEN quantity ELSE 0 END) as total_quantity,
      COUNT(DISTINCT store_code) as total_stores,
      COUNT(DISTINCT product_code) as total_products,
      COUNT(DISTINCT field_user_code) as total_users,
      'AED' as currency_code
    FROM flat_sales_transactions
    ${whereClause ? 'WHERE ' + whereClause : ''}
  `

  const result = await db.query(query, params)
  const row = result.rows[0]

  return {
    totalSales: parseFloat(row.total_sales || 0),
    totalNetSales: parseFloat(row.total_net_sales || 0),
    totalDiscount: parseFloat(row.total_discount || 0),
    totalOrders: parseInt(row.total_orders || 0),
    totalQuantity: parseFloat(row.total_quantity || 0),
    totalStores: parseInt(row.total_stores || 0),
    totalProducts: parseInt(row.total_products || 0),
    totalUsers: parseInt(row.total_users || 0),
    currencyCode: row.currency_code
  }
}

export async function getDailySalesTrend(filters: SalesFilters): Promise<DailyTrend[]> {
  const dateFilter = buildDateFilter('trx_date_only', filters.startDate, filters.endDate)

  const query = `
    SELECT
      trx_date_only as date,
      SUM(CASE WHEN trx_type = 'Sales' THEN net_amount ELSE 0 END) as sales
    FROM flat_sales_transactions
    WHERE ${dateFilter.clause}
    GROUP BY trx_date_only
    ORDER BY trx_date_only ASC
  `

  const result = await db.query(query, dateFilter.params)
  return result.rows.map(row => ({
    date: row.date,
    sales: parseFloat(row.sales || 0)
  }))
}

export async function getProductPerformance(filters: SalesFilters, limit: number = 1000): Promise<ProductPerformance[]> {
  const dateFilter = buildDateFilter('trx_date_only', filters.startDate, filters.endDate)
  let paramIndex = dateFilter.index

  const conditions: string[] = [dateFilter.clause, "trx_type = 'Sales'"]
  const params = [...dateFilter.params]

  if (filters.productCategory) {
    conditions.push(`product_group_level1 = $${paramIndex++}`)
    params.push(filters.productCategory)
  }

  const whereClause = conditions.join(' AND ')

  const query = `
    SELECT
      product_code,
      product_name,
      product_group_level1 as product_category,
      SUM(quantity) as quantity,
      SUM(unit_price * quantity) as sales,
      SUM(total_discount_amount) as discount,
      SUM(net_amount) as net_sales,
      COUNT(DISTINCT trx_code) as orders,
      COUNT(DISTINCT store_code) as stores
    FROM flat_sales_transactions
    WHERE ${whereClause}
    GROUP BY product_code, product_name, product_group_level1
    ORDER BY net_sales DESC
    LIMIT $${paramIndex}
  `

  params.push(limit)
  const result = await db.query(query, params)

  return result.rows.map(row => ({
    productCode: row.product_code,
    productName: row.product_name,
    productCategory: row.product_category,
    quantity: parseFloat(row.quantity || 0),
    sales: parseFloat(row.sales || 0),
    discount: parseFloat(row.discount || 0),
    netSales: parseFloat(row.net_sales || 0),
    orders: parseInt(row.orders || 0),
    stores: parseInt(row.stores || 0)
  }))
}

export async function getStorePerformance(filters: SalesFilters, limit: number = 1000): Promise<StorePerformance[]> {
  const dateFilter = buildDateFilter('trx_date_only', filters.startDate, filters.endDate)
  const conditions: string[] = [dateFilter.clause, "trx_type = 'Sales'"]

  const whereClause = conditions.join(' AND ')

  const query = `
    SELECT
      store_code,
      store_name,
      store_classification as store_class,
      store_city_code as city_code,
      store_region_code as region_code,
      SUM(quantity) as quantity,
      SUM(net_amount) as net_sales,
      COUNT(DISTINCT trx_code) as orders,
      COUNT(DISTINCT product_code) as products
    FROM flat_sales_transactions
    WHERE ${whereClause}
    GROUP BY store_code, store_name, store_classification, store_city_code, store_region_code
    ORDER BY net_sales DESC
    LIMIT ${limit}
  `

  const result = await db.query(query, dateFilter.params)

  return result.rows.map(row => ({
    storeCode: row.store_code,
    storeName: row.store_name,
    storeClass: row.store_class,
    cityCode: row.city_code,
    regionCode: row.region_code,
    quantity: parseFloat(row.quantity || 0),
    netSales: parseFloat(row.net_sales || 0),
    orders: parseInt(row.orders || 0),
    products: parseInt(row.products || 0)
  }))
}

export async function getUserPerformance(filters: SalesFilters, limit: number = 1000): Promise<UserPerformance[]> {
  const dateFilter = buildDateFilter('trx_date_only', filters.startDate, filters.endDate)
  const conditions: string[] = [dateFilter.clause, "trx_type = 'Sales'"]

  const whereClause = conditions.join(' AND ')

  const query = `
    SELECT
      field_user_code as user_code,
      field_user_name as user_name,
      field_user_type as user_type,
      SUM(quantity) as quantity,
      SUM(net_amount) as net_sales,
      COUNT(DISTINCT trx_code) as orders,
      COUNT(DISTINCT store_code) as stores,
      COUNT(DISTINCT product_code) as products,
      AVG(net_amount) as avg_order_value
    FROM flat_sales_transactions
    WHERE ${whereClause}
    GROUP BY field_user_code, field_user_name, field_user_type
    ORDER BY net_sales DESC
    LIMIT ${limit}
  `

  const result = await db.query(query, dateFilter.params)

  return result.rows.map(row => ({
    userCode: row.user_code,
    userName: row.user_name,
    userType: row.user_type,
    quantity: parseFloat(row.quantity || 0),
    netSales: parseFloat(row.net_sales || 0),
    orders: parseInt(row.orders || 0),
    stores: parseInt(row.stores || 0),
    products: parseInt(row.products || 0),
    avgOrderValue: parseFloat(row.avg_order_value || 0)
  }))
}

export async function getSalesTransactions(filters: SalesFilters, limit: number = 500): Promise<FlatSalesTransaction[]> {
  const dateFilter = buildDateFilter('trx_date_only', filters.startDate, filters.endDate)
  const conditions: string[] = [dateFilter.clause]

  const whereClause = conditions.join(' AND ')

  const query = `
    SELECT *
    FROM flat_sales_transactions
    WHERE ${whereClause}
    ORDER BY trx_date DESC, trx_code, line_number
    LIMIT ${limit}
  `

  const result = await db.query(query, dateFilter.params)
  return result.rows
}

// ============================================================================
// ATTENDANCE REPORT QUERIES
// ============================================================================

export async function getAttendanceAnalytics(filters: AttendanceFilters): Promise<AttendanceSummary[]> {
  const dateFilter = buildDateFilter('attendance_date', filters.startDate, filters.endDate)
  let paramIndex = dateFilter.index

  const conditions: string[] = [dateFilter.clause]
  const params = [...dateFilter.params]

  if (filters.userCode) {
    conditions.push(`user_code = $${paramIndex++}`)
    params.push(filters.userCode)
  }
  if (filters.userType) {
    conditions.push(`user_type = $${paramIndex++}`)
    params.push(filters.userType)
  }
  if (filters.attendanceStatus && filters.attendanceStatus !== 'all') {
    conditions.push(`attendance_status = $${paramIndex++}`)
    params.push(filters.attendanceStatus)
  }

  const whereClause = conditions.filter(c => c).join(' AND ')

  const query = `
    SELECT
      user_code,
      user_name,
      user_type as role,
      COUNT(*) as total_days,
      COUNT(*) FILTER (WHERE attendance_status = 'Present') as present_days,
      COUNT(*) FILTER (WHERE attendance_status = 'Absent') as absent_days,
      COUNT(*) FILTER (WHERE attendance_status LIKE '%Leave%') as leave_days,
      SUM(working_hours) as total_working_hours,
      SUM(working_hours) as total_productive_hours,
      0 as total_field_hours,
      0 as total_customer_visits,
      0 as total_sales_amount,
      AVG(CASE WHEN working_hours > 0 THEN 100 ELSE 0 END) as avg_efficiency,
      (COUNT(*) FILTER (WHERE attendance_status = 'Present')::float / NULLIF(COUNT(*), 0) * 100) as attendance_percentage
    FROM flat_attendance_daily
    ${whereClause ? 'WHERE ' + whereClause : ''}
    GROUP BY user_code, user_name, user_type
    ORDER BY attendance_percentage DESC
  `

  const result = await db.query(query, params)

  return result.rows.map(row => ({
    userCode: row.user_code,
    userName: row.user_name,
    role: row.role,
    attendancePercentage: parseFloat(row.attendance_percentage || 0),
    presentDays: parseInt(row.present_days || 0),
    absentDays: parseInt(row.absent_days || 0),
    leaveDays: parseInt(row.leave_days || 0),
    totalWorkingHours: parseFloat(row.total_working_hours || 0),
    totalProductiveHours: parseFloat(row.total_productive_hours || 0),
    totalFieldHours: parseFloat(row.total_field_hours || 0),
    totalCustomerVisits: parseInt(row.total_customer_visits || 0),
    totalSalesAmount: parseFloat(row.total_sales_amount || 0),
    avgEfficiency: parseFloat(row.avg_efficiency || 0)
  }))
}

// ============================================================================
// FILTER OPTIONS QUERIES
// ============================================================================

export async function getSalesFilterOptions(filters?: Partial<SalesFilters>): Promise<FilterOptions> {
  const dateFilter = filters?.startDate && filters?.endDate
    ? `WHERE trx_date_only BETWEEN '${filters.startDate}' AND '${filters.endDate}'`
    : ''

  const [storesRes, productsRes, usersRes, regionsRes, categoriesRes, tlsRes, chainsRes] = await Promise.all([
    db.query(`SELECT DISTINCT store_code as value, store_name || ' (' || store_code || ')' as label, store_code as code
              FROM flat_sales_transactions ${dateFilter} ORDER BY store_name LIMIT 1000`),
    db.query(`SELECT DISTINCT product_code as value, product_name || ' (' || product_code || ')' as label, product_code as code
              FROM flat_sales_transactions ${dateFilter} ORDER BY product_name LIMIT 1000`),
    db.query(`SELECT DISTINCT field_user_code as value, field_user_name || ' (' || field_user_code || ')' as label, field_user_code as code
              FROM flat_sales_transactions ${dateFilter} ORDER BY field_user_name LIMIT 500`),
    db.query(`SELECT DISTINCT store_region_code as value, store_region_code as label, store_region_code as code
              FROM flat_sales_transactions WHERE store_region_code IS NOT NULL ${dateFilter ? 'AND' + dateFilter.replace('WHERE', '') : ''} ORDER BY store_region_code`),
    db.query(`SELECT DISTINCT product_group_level1 as value, product_group_level1 as label
              FROM flat_sales_transactions WHERE product_group_level1 IS NOT NULL ${dateFilter ? 'AND' + dateFilter.replace('WHERE', '') : ''} ORDER BY product_group_level1`),
    db.query(`SELECT DISTINCT field_user_code as value, field_user_name || ' (' || field_user_code || ')' as label, field_user_code as code
              FROM flat_sales_transactions WHERE field_user_type = 'Team Leader' ${dateFilter ? 'AND' + dateFilter.replace('WHERE', '') : ''} ORDER BY field_user_name LIMIT 200`),
    db.query(`SELECT DISTINCT store_classification as value, store_classification as label
              FROM flat_sales_transactions WHERE store_classification IS NOT NULL ${dateFilter ? 'AND' + dateFilter.replace('WHERE', '') : ''} ORDER BY store_classification`)
  ])

  return {
    stores: storesRes.rows,
    products: productsRes.rows,
    users: usersRes.rows,
    regions: regionsRes.rows,
    categories: categoriesRes.rows,
    currencies: [{ value: 'AED', label: 'AED (UAE Dirham)', code: 'AED' }],
    tls: tlsRes.rows,
    chains: chainsRes.rows
  }
}

export async function getAttendanceFilterOptions(): Promise<any> {
  const [usersRes, typesRes, statusRes] = await Promise.all([
    db.query(`SELECT DISTINCT user_code as value, user_name || ' (' || user_code || ')' as label, user_code as code
              FROM flat_attendance_daily ORDER BY user_name LIMIT 500`),
    db.query(`SELECT DISTINCT user_type as value, user_type as label FROM flat_attendance_daily WHERE user_type IS NOT NULL ORDER BY user_type`),
    db.query(`SELECT DISTINCT attendance_status as value, attendance_status as label FROM flat_attendance_daily ORDER BY attendance_status`)
  ])

  return {
    users: usersRes.rows,
    userTypes: typesRes.rows,
    attendanceStatuses: statusRes.rows
  }
}

export { formatCurrency }
