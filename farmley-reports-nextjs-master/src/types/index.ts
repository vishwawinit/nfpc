// Transaction Types
export interface Transaction {
  trxCode: string
  appTrxId: string
  orgCode: string
  journeyCode: string | null
  visitCode: string | null
  userCode: string
  userName?: string
  clientCode: string
  clientName?: string
  trxDate: Date
  trxType: number // 1=Order, 2=Invoice, 3=Return
  paymentType: number // 1=Cash, 2=Credit
  totalAmount: number
  totalDiscountAmount: number
  totalTaxAmount: number
  status: number // 0=Draft, 1=Submitted, 2=Approved, 3=Delivered, 4=Invoiced, 5=Paid
  isVanSales: boolean
  routeCode: string
  routeName?: string
  geoX?: string
  geoY?: string
}

// Customer Types
export interface Customer {
  customerCode: string
  customerName: string
  customerArabicName?: string
  customerType: string
  routeCode: string
  routeName?: string
  channelCode?: string
  classificationCode?: string
  creditLimit: number
  outstandingAmount: number
  lastOrderDate?: Date
  totalOrders: number
  totalSales: number
  averageOrderValue: number
  status: 'Active' | 'Inactive' | 'Blocked'
  gpsLatitude?: number
  gpsLongitude?: number
}

// Product Types
export interface Product {
  itemCode: string
  itemDescription: string
  itemArabicDescription?: string
  category: string
  subCategory?: string
  brand?: string
  brandCode?: string
  baseUOM: string
  salesUOM: string
  conversionFactor: number
  price: number
  taxPercentage: number
  isActive: boolean
  totalQuantitySold: number
  totalRevenue: number
  averagePrice: number
}

// Journey Types
export interface Journey {
  journeyCode: string
  userCode: string
  userName: string
  routeCode: string
  routeName: string
  journeyDate: Date
  startTime: Date
  endTime: Date
  startOdometer: number
  endOdometer: number
  totalVisits: number
  productiveVisits: number
  totalSales: number
  status: string
}

// Visit Types
export interface Visit {
  visitId: string
  journeyCode: string
  customerCode: string
  customerName: string
  checkInTime: Date
  checkOutTime: Date
  visitDuration: number // in minutes
  visitType: number // 1=Productive, 2=Non-Productive
  reasonCode?: string
  outcomeCode?: string
  gpsLatitude: number
  gpsLongitude: number
  salesAmount: number
}

// Target Types
export interface Target {
  targetCode: string
  userCode: string
  userName: string
  periodType: 'Daily' | 'Weekly' | 'Monthly'
  startDate: Date
  endDate: Date
  targetAmount: number
  achievedAmount: number
  achievementPercentage: number
  status: 'Achieved' | 'On Track' | 'Behind' | 'Critical'
}

// Dashboard KPI Types
export interface DashboardKPI {
  // Legacy fields for backward compatibility
  todaySales: number
  todayOrders: number
  todayCustomers: number
  todayUnits?: number
  growthPercentage: number
  mtdSales: number
  ytdSales: number
  averageOrderValue: number
  conversionRate: number
  
  // Current period fields
  currentSales?: number
  currentOrders?: number
  currentCustomers?: number
  currentUnits?: number
  currentNetSales?: number
  currentNetOrders?: number
  currentUniqueCustomers?: number
  currentTotalUnits?: number
  
  // Change percentages
  salesChange?: number
  ordersChange?: number
  customersChange?: number
  unitsChange?: number
  
  // Currency fields
  currencyCode?: string
  currencySymbol?: string
}

// Chart Data Types
export interface ChartDataPoint {
  date: string
  value: number
  label?: string
}

export interface SalesTrendData {
  date: string
  sales: number
  orders: number
  customers: number
}

// Filter Types
export interface FilterOptions {
  startDate: Date
  endDate: Date
  organizationCode?: string
  routeCode?: string
  userCode?: string
  customerType?: string
  productCategory?: string
}

// Report Types
export interface ReportData {
  filters: FilterOptions
  data: any[]
  summary: {
    totalRecords: number
    totalValue?: number
    averageValue?: number
  }
  generatedAt: Date
}