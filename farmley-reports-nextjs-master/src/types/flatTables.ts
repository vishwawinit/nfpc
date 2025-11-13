// TypeScript interfaces for PostgreSQL Flat Tables
// Based on FLAT_TABLES_COMPLETE_DOCUMENTATION.md

// ============================================================================
// 1. FLAT_SALES_TRANSACTIONS
// ============================================================================
export interface FlatSalesTransaction {
  trx_date_only: string // DATE
  trx_code: string
  line_number: number
  trx_date: string // TIMESTAMP
  trx_time: string // TIME
  trx_type: string
  store_code: string
  store_name: string
  store_classification: string | null
  store_city_code: string | null
  store_region_code: string | null
  store_country_code: string | null
  field_user_code: string
  field_user_name: string
  field_user_route_code: string | null
  field_user_type: string | null
  product_code: string
  product_name: string
  product_base_uom: string | null
  product_group_level1: string | null
  product_group_level2: string | null
  product_group_level3: string | null
  quantity: number
  quantity_level1: number | null
  quantity_bu: number | null
  unit_price: number
  list_price: number | null
  base_price: number | null
  price_used_level1: number | null
  discount_percentage: number
  total_discount_amount: number
  tax_percentage: number
  tax_amount: number
  net_amount: number
  remarks: string | null
  created_on: string // TIMESTAMP
  created_by: string | null
  trx_modified_on: string // TIMESTAMP
  modified_by: string | null
}

// ============================================================================
// 2. FLAT_STOCK_CHECKS
// ============================================================================
export interface FlatStockCheck {
  check_date: string // DATE
  store_code: string
  store_name: string
  store_classification: string | null
  store_city_code: string | null
  store_region_code: string | null
  field_user_code: string
  field_user_name: string
  field_user_type: string | null
  product_code: string
  product_name: string
  product_group_level1: string | null
  product_group_level2: string | null
  product_group_level3: string | null
  on_hand_qty: number
  on_order_qty: number | null
  shelf_presence: string | null
  stock_status: string | null
  remarks: string | null
  created_on: string // TIMESTAMP
  check_modified_on: string // TIMESTAMP
}

// ============================================================================
// 3. FLAT_STORE_VISITS
// ============================================================================
export interface FlatStoreVisit {
  visit_date: string // DATE
  store_code: string
  store_name: string
  store_classification: string | null
  city_code: string | null // Changed from store_city_code to match actual table
  region_code: string | null // Added - exists in actual table
  chain_code: string | null // Added - exists in actual table
  chain_name: string | null // Added - exists in actual table
  field_user_code: string
  field_user_name: string
  field_user_type: string | null
  user_role: string | null // Added - exists in actual table
  tl_code: string | null // Added - Team Leader code
  tl_name: string | null // Added - Team Leader name
  arrival_time: string // TIME
  out_time: string | null // Changed from departure_time to match actual table
  total_time_mins: number | null // Added - exists in actual table
  duration_minutes: number | null
  visit_purpose: string | null
  visit_status: string | null // Changed from visit_outcome to match actual table
  remarks: string | null
  image_path: string | null
  latitude: number | null
  longitude: number | null
  created_on: string // TIMESTAMP
  visit_modified_on: string // TIMESTAMP
}

// ============================================================================
// 4. FLAT_ATTENDANCE_DAILY
// ============================================================================
export interface FlatAttendanceDaily {
  attendance_date: string // DATE
  user_code: string
  user_name: string
  user_type: string | null
  user_route_code: string | null
  attendance_status: string
  leave_type: string | null
  check_in_time: string | null // TIME
  check_out_time: string | null // TIME
  working_hours: number | null
  location_check_in: string | null
  location_check_out: string | null
  remarks: string | null
  created_on: string // TIMESTAMP
  attendance_modified_on: string | null // TIMESTAMP
}

// ============================================================================
// 5. FLAT_EXPIRY_CHECKS
// ============================================================================
export interface FlatExpiryCheck {
  visited_date: string // DATE
  customer_code: string
  customer_name: string
  field_user_code: string
  field_user_name: string
  product_code: string
  product_name: string
  batch_number: string | null
  expiry_date: string | null // DATE
  quantity_near_expiry: number | null
  days_to_expiry: number | null
  action_taken: string | null
  remarks: string | null
  created_on: string // TIMESTAMP
}

// ============================================================================
// 6. FLAT_BROADCAST_INITIATIVES
// ============================================================================
export interface FlatBroadcastInitiative {
  initiative_date: string // DATE
  store_code: string
  store_name: string
  field_user_code: string
  field_user_name: string
  mobile_number: string
  initiative_type: string | null
  campaign_name: string | null
  message_sent: string | null
  response_received: string | null
  remarks: string | null
  created_datetime: string // TIMESTAMP
}

// ============================================================================
// 7. FLAT_COMPETITOR_OBSERVATIONS
// ============================================================================
export interface FlatCompetitorObservation {
  observation_date: string // DATE
  store_code: string
  store_name: string
  field_user_code: string
  field_user_name: string
  competition_brand_name: string
  product_name: string
  product_category: string | null
  pack_size: string | null
  competitor_price: number | null
  our_price: number | null
  shelf_share_percentage: number | null
  promotion_details: string | null
  remarks: string | null
  created_datetime: string // TIMESTAMP
}

// ============================================================================
// 8. FLAT_PLANOGRAM_EXECUTIONS
// ============================================================================
export interface FlatPlanogramExecution {
  execution_date: string // DATE
  store_code: string
  store_name: string
  field_user_code: string
  field_user_name: string
  execution_type: string
  planogram_name: string | null
  compliance_status: string | null
  compliance_percentage: number | null
  before_image_path: string | null
  after_image_path: string | null
  remarks: string | null
  created_on: string // TIMESTAMP
}

// ============================================================================
// 9. FLAT_PURCHASE_ORDERS
// ============================================================================
export interface FlatPurchaseOrder {
  po_date: string // DATE
  trx_code: string
  line_number: number
  supplier_code: string
  supplier_name: string
  product_code: string
  product_name: string
  quantity_ordered: number
  unit_price: number
  total_amount: number
  po_status: string | null
  expected_delivery_date: string | null // DATE
  remarks: string | null
  created_on: string // TIMESTAMP
}

// ============================================================================
// 10. FLAT_PRODUCT_SAMPLING
// ============================================================================
export interface FlatProductSampling {
  sampling_date: string // DATE
  store_code: string
  store_name: string
  field_user_code: string
  field_user_name: string
  sku_code: string
  sku_name: string
  quantity_distributed: number
  customer_feedback: string | null
  conversion_to_sales: string | null
  remarks: string | null
  created_datetime: string // TIMESTAMP
}

// ============================================================================
// 11. FLAT_ROTA_ACTIVITIES
// ============================================================================
export interface FlatRotaActivity {
  rota_id: number
  rota_date: string // DATE
  user_code: string
  user_name: string
  route_code: string | null
  route_name: string | null
  planned_stores: number | null
  visited_stores: number | null
  activity_type: string | null
  start_time: string | null // TIME
  end_time: string | null // TIME
  remarks: string | null
  created_on: string // TIMESTAMP
}

// ============================================================================
// 12. FLAT_TARGETS
// ============================================================================
export interface FlatTarget {
  // Primary identifiers
  target_year: number
  target_month: number
  target_period: string | null // e.g., "2025-10"
  
  // User information
  field_user_code: string
  field_user_name: string | null
  tl_code: string | null
  tl_name: string | null
  user_role: string | null
  
  // Customer information
  customer_code: string
  customer_name: string | null
  customer_level: string | null // C for Customer level
  chain_code: string | null
  
  // Target values
  target_amount: number | null
  target_quantity: number | null
  target_volume: number | null
  
  // Achievement (calculated from flat_sales_transactions as these are NULL in DB)
  target_value: number | null // Legacy column (NULL in DB)
  achieved_value: number | null // NULL in DB - calculated at runtime
  achievement_percentage: number | null // NULL in DB - calculated at runtime
  
  // Configuration
  currency_code: string | null // e.g., "INR"
  uom: string | null // Unit of measure
  
  // Organization
  sales_org_code: string | null // e.g., "Farmley"
  sales_org_name: string | null
  
  // Product categorization
  product_category: string | null
  product_brand: string | null
  
  // Target metadata
  target_type: string | null // e.g., "Monthly"
  target_level: string | null // e.g., "C"
  target_frequency: string | null // e.g., "Monthly"
  target_status: string | null // e.g., "Active"
  
  // Status flags
  is_active: boolean | null
  is_approved: boolean | null
  
  // Approval tracking
  approved_by: string | null
  approved_on: string | null // TIMESTAMP
  
  // Additional info
  remarks: string | null
  
  // Audit fields
  created_by: string | null
  created_on: string | null // TIMESTAMP
  modified_by: string | null
  modified_on: string | null // TIMESTAMP
  sync_timestamp: string | null // TIMESTAMP
}

// ============================================================================
// HELPER TYPES FOR API RESPONSES
// ============================================================================

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  message?: string
  timestamp?: string
  cached?: boolean
  source?: string
}

// Filter types
export interface DateRangeFilter {
  startDate: string
  endDate: string
}

export interface BaseFilters extends DateRangeFilter {
  userCode?: string
  tlCode?: string
  storeCode?: string
  regionCode?: string
}

export interface SalesFilters extends BaseFilters {
  productCode?: string
  productCategory?: string
  storeClassification?: string
  channel?: string
}

export interface AttendanceFilters extends DateRangeFilter {
  userCode?: string
  userType?: string
  attendanceStatus?: string
  department?: string
  role?: string
}

export interface VisitFilters extends BaseFilters {
  chainCode?: string
  visitPurpose?: string
  visitOutcome?: string
}

export interface TargetFilters {
  year: number
  month: number
  userCode?: string
  tlCode?: string
  customerCode?: string
  targetType?: string
}

export interface CompetitionFilters extends BaseFilters {
  competitionBrandName?: string
  productName?: string
  chainCode?: string
}

// Aggregated data types for reports
export interface DailySalesSummary {
  totalSales: number
  totalNetSales: number
  totalDiscount: number
  totalOrders: number
  totalQuantity: number
  totalStores: number
  totalProducts: number
  totalUsers: number
  currencyCode?: string
}

export interface ProductPerformance {
  productCode: string
  productName: string
  productCategory: string | null
  quantity: number
  sales: number
  discount: number
  netSales: number
  orders: number
  stores: number
}

export interface StorePerformance {
  storeCode: string
  storeName: string
  storeClass: string | null
  cityCode: string | null
  regionCode: string | null
  quantity: number
  netSales: number
  orders: number
  products: number
}

export interface UserPerformance {
  userCode: string
  userName: string
  userType: string | null
  quantity: number
  netSales: number
  orders: number
  stores: number
  products: number
  avgOrderValue: number
}

export interface AttendanceSummary {
  userCode: string
  userName: string
  role?: string
  department?: string
  attendancePercentage: number
  presentDays: number
  absentDays: number
  leaveDays: number
  totalWorkingHours: number
  totalProductiveHours: number
  totalFieldHours: number
  totalCustomerVisits?: number
  totalSalesAmount?: number
  avgEfficiency?: number
}

export interface DailyTrend {
  date: string
  sales: number
}

export interface FilterOption {
  value: string
  label: string
  code?: string
}

export interface FilterOptions {
  stores: FilterOption[]
  products: FilterOption[]
  users: FilterOption[]
  regions: FilterOption[]
  categories: FilterOption[]
  currencies: FilterOption[]
  chains?: FilterOption[]
  tls?: FilterOption[]
}
