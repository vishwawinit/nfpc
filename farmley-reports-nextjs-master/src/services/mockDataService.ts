// Mock Data Service
// Provides data access functions that mimic database queries but use static mock data

import { mockData } from '../data/mockData'

// Helper function to filter by date range
const filterByDateRange = (items: any[], dateField: string, startDate: Date, endDate: Date) => {
  return items.filter(item => {
    const itemDate = new Date(item[dateField])
    return itemDate >= startDate && itemDate <= endDate
  })
}

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
    case 'thisWeek':
      startDate = new Date(current)
      startDate.setDate(startDate.getDate() - 6)
      break
    case 'lastWeek':
      startDate = new Date(current)
      startDate.setDate(startDate.getDate() - 13)
      endDate = new Date(current)
      endDate.setDate(endDate.getDate() - 7)
      break
    case 'thisMonth':
      startDate = new Date(current.getFullYear(), current.getMonth(), 1)
      break
    case 'lastMonth':
      startDate = new Date(current.getFullYear(), current.getMonth() - 1, 1)
      endDate = new Date(current.getFullYear(), current.getMonth(), 0)
      break
    case 'thisQuarter':
      const currentQuarter = Math.floor(current.getMonth() / 3)
      startDate = new Date(current.getFullYear(), currentQuarter * 3, 1)
      break
    case 'lastQuarter':
      const lastQuarter = Math.floor(current.getMonth() / 3) - 1
      startDate = new Date(current.getFullYear(), lastQuarter * 3, 1)
      endDate = new Date(current.getFullYear(), (lastQuarter + 1) * 3, 0)
      break
    case 'thisYear':
      startDate = new Date(current.getFullYear(), 0, 1)
      break
    case 'last30Days':
    case 'last30days':
    default:
      startDate = new Date(current)
      startDate.setDate(startDate.getDate() - 29)
  }

  return { startDate, endDate }
}

/**
 * Dashboard KPI Data
 */
export const getKPIData = async (dateRange: string = 'thisMonth', currentDate: string = new Date().toISOString().split('T')[0]) => {
  const { startDate, endDate } = getDateRangeFromString(dateRange, currentDate)

  // Get current period data
  const currentTransactions = filterByDateRange(mockData.transactions, 'trxDate', startDate, endDate)
  const currentSales = currentTransactions.filter(t => t.trxType === 'SALE')
  const currentReturns = currentTransactions.filter(t => t.trxType === 'RETURN')

  const currentTotalSales = currentSales.reduce((sum, t) => sum + t.totalAmount, 0)
  const currentReturnSales = Math.abs(currentReturns.reduce((sum, t) => sum + t.totalAmount, 0))
  const currentNetSales = currentTotalSales - currentReturnSales
  const currentTotalOrders = currentSales.length
  const currentReturnOrders = currentReturns.length
  const currentNetOrders = currentTotalOrders - currentReturnOrders
  const currentUniqueCustomers = new Set(currentSales.map(t => t.clientCode)).size

  // Get previous period data for comparison
  const periodLength = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
  const prevStartDate = new Date(startDate)
  prevStartDate.setDate(prevStartDate.getDate() - periodLength)
  const prevEndDate = new Date(endDate)
  prevEndDate.setDate(prevEndDate.getDate() - periodLength)

  const prevTransactions = filterByDateRange(mockData.transactions, 'trxDate', prevStartDate, prevEndDate)
  const prevSales = prevTransactions.filter(t => t.trxType === 'SALE')
  const prevReturns = prevTransactions.filter(t => t.trxType === 'RETURN')

  const prevTotalSales = prevSales.reduce((sum, t) => sum + t.totalAmount, 0)
  const prevReturnSales = Math.abs(prevReturns.reduce((sum, t) => sum + t.totalAmount, 0))
  const prevNetSales = prevTotalSales - prevReturnSales
  const prevTotalOrders = prevSales.length
  const prevReturnOrders = prevReturns.length
  const prevNetOrders = prevTotalOrders - prevReturnOrders
  const prevUniqueCustomers = new Set(prevSales.map(t => t.clientCode)).size

  // Calculate changes
  const netSalesChange = prevNetSales > 0 ? ((currentNetSales - prevNetSales) / prevNetSales * 100) : 0
  const netOrdersChange = prevNetOrders > 0 ? ((currentNetOrders - prevNetOrders) / prevNetOrders * 100) : 0
  const uniqueCustomersChange = prevUniqueCustomers > 0 ? ((currentUniqueCustomers - prevUniqueCustomers) / prevUniqueCustomers * 100) : 0

  // Calculate average order value
  const currentAvgOrder = currentNetOrders > 0 ? currentNetSales / currentNetOrders : 0
  const prevAvgOrder = prevNetOrders > 0 ? prevNetSales / prevNetOrders : 0
  const avgOrderChange = prevAvgOrder > 0 ? ((currentAvgOrder - prevAvgOrder) / prevAvgOrder * 100) : 0

  // MTD and YTD calculations
  const mtdStartDate = new Date(new Date(currentDate).getFullYear(), new Date(currentDate).getMonth(), 1)
  const mtdSales = filterByDateRange(mockData.transactions, 'trxDate', mtdStartDate, new Date(currentDate))
    .filter(t => t.trxType === 'SALE')
    .reduce((sum, t) => sum + t.totalAmount, 0)

  const ytdStartDate = new Date(new Date(currentDate).getFullYear(), 0, 1)
  const ytdSales = filterByDateRange(mockData.transactions, 'trxDate', ytdStartDate, new Date(currentDate))
    .filter(t => t.trxType === 'SALE')
    .reduce((sum, t) => sum + t.totalAmount, 0)

  return {
    currentTotalSales,
    currentReturnSales,
    currentNetSales,
    currentTotalOrders,
    currentReturnOrders,
    currentNetOrders,
    currentUniqueCustomers,
    prevTotalSales,
    prevReturnSales,
    prevNetSales,
    prevTotalOrders,
    prevReturnOrders,
    prevNetOrders,
    prevUniqueCustomers,
    averageOrderValue: currentAvgOrder,
    netSalesChange,
    netOrdersChange,
    uniqueCustomersChange,
    avgOrderChange,
    dateRange,
    mtdSales,
    ytdSales,
    // Backward compatibility
    currentSales: currentNetSales,
    currentOrders: currentNetOrders,
    currentCustomers: currentUniqueCustomers,
    todaySales: currentNetSales,
    todayOrders: currentNetOrders,
    todayCustomers: currentUniqueCustomers,
    growthPercentage: netSalesChange,
    salesChange: netSalesChange,
    ordersChange: netOrdersChange,
    customersChange: uniqueCustomersChange,
    conversionRate: 75
  }
}

/**
 * Sales Trend Data
 */
export const getSalesTrend = async (dateRange: string = 'thisMonth', days: number = 30) => {
  const { startDate, endDate } = getDateRangeFromString(dateRange)
  const filteredDailySales = filterByDateRange(mockData.dailySales, 'saleDate', startDate, endDate)

  return filteredDailySales.map(ds => ({
    date: ds.sale_date,
    sales: ds.totalSales,
    orders: ds.totalTransactions,
    customers: ds.totalCustomers,
    returns: ds.totalReturns || 0
  })).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
}

/**
 * Top Customers
 */
export const getTopCustomers = async (limit: number = 10, dateRange: string = 'thisMonth') => {
  const { startDate, endDate } = getDateRangeFromString(dateRange)
  const filteredTransactions = filterByDateRange(mockData.transactions, 'trxDate', startDate, endDate)
    .filter(t => t.trxType === 'SALE')

  // Group by customer
  const customerSales: { [key: string]: { totalSales: number, totalOrders: number, customerName: string } } = {}

  filteredTransactions.forEach(t => {
    if (!customerSales[t.clientCode]) {
      customerSales[t.clientCode] = {
        totalSales: 0,
        totalOrders: 0,
        customerName: t.clientName
      }
    }
    customerSales[t.clientCode].totalSales += t.totalAmount
    customerSales[t.clientCode].totalOrders += 1
  })

  // Convert to array and sort
  const topCustomers = Object.entries(customerSales)
    .map(([code, data]) => ({
      customerCode: code,
      customerName: data.customerName,
      totalSales: data.totalSales,
      totalOrders: data.totalOrders
    }))
    .sort((a, b) => b.totalSales - a.totalSales)
    .slice(0, limit)

  return topCustomers
}

/**
 * Top Products
 */
export const getTopProducts = async (limit: number = 10, dateRange: string = 'thisMonth') => {
  const { startDate, endDate } = getDateRangeFromString(dateRange)
  const filteredTransactions = filterByDateRange(mockData.transactions, 'trxDate', startDate, endDate)
    .filter(t => t.trxType === 'SALE')

  // Aggregate product sales
  const productSales: { [key: string]: { quantitySold: number, salesAmount: number, productName: string } } = {}

  filteredTransactions.forEach(t => {
    t.items.forEach((item: any) => {
      if (!productSales[item.productCode]) {
        productSales[item.productCode] = {
          quantitySold: 0,
          salesAmount: 0,
          productName: item.productName
        }
      }
      productSales[item.productCode].quantitySold += item.quantity
      productSales[item.productCode].salesAmount += item.total
    })
  })

  // Convert to array and sort
  const topProducts = Object.entries(productSales)
    .map(([code, data]) => ({
      productCode: code,
      productName: data.productName,
      quantitySold: data.quantitySold,
      salesAmount: data.salesAmount
    }))
    .sort((a, b) => b.salesAmount - a.salesAmount)
    .slice(0, limit)

  return topProducts
}

/**
 * Recent Transactions
 */
export const getTransactions = async (filters: any = {}, limit: number = 10) => {
  let transactions = [...mockData.transactions]

  // Apply filters
  if (filters.startDate && filters.endDate) {
    transactions = filterByDateRange(transactions, 'trxDate', filters.startDate, filters.endDate)
  }

  if (filters.customerCode) {
    transactions = transactions.filter(t => t.clientCode === filters.customerCode)
  }

  if (filters.userCode) {
    transactions = transactions.filter(t => t.userCode === filters.userCode)
  }

  if (filters.routeCode) {
    transactions = transactions.filter(t => t.routeCode === filters.routeCode)
  }

  // Sort by date descending
  transactions.sort((a, b) => new Date(b.trxDate).getTime() - new Date(a.trxDate).getTime())

  return transactions.slice(0, limit)
}

/**
 * Sales Performance Data
 */
export const getSalesPerformance = async (filters: any = {}) => {
  let transactions = [...mockData.transactions]

  // Apply date filter
  if (filters.startDate && filters.endDate) {
    transactions = filterByDateRange(transactions, 'trxDate', new Date(filters.startDate), new Date(filters.endDate))
  }

  // Apply other filters
  if (filters.routeCode) {
    transactions = transactions.filter(t => t.routeCode === filters.routeCode)
  }

  if (filters.userCode) {
    transactions = transactions.filter(t => t.userCode === filters.userCode)
  }

  // Aggregate by salesman
  const salesmanPerformance: any = {}

  mockData.salesmen.forEach(salesman => {
    const salesmanTrx = transactions.filter(t => t.userCode === salesman.userCode && t.trxType === 'SALE')
    const totalSales = salesmanTrx.reduce((sum, t) => sum + t.totalAmount, 0)
    const totalOrders = salesmanTrx.length
    const uniqueCustomers = new Set(salesmanTrx.map(t => t.clientCode)).size

    salesmanPerformance[salesman.userCode] = {
      userCode: salesman.userCode,
      userName: salesman.userName,
      routeCode: salesman.routeCode,
      routeName: mockData.routes.find(r => r.routeCode === salesman.routeCode)?.routeName,
      totalSales,
      totalOrders,
      uniqueCustomers,
      averageOrderValue: totalOrders > 0 ? totalSales / totalOrders : 0
    }
  })

  return Object.values(salesmanPerformance)
}

/**
 * Customer Analytics
 */
export const getCustomerAnalytics = async (filters: any = {}) => {
  return mockData.customers.map(customer => {
    const customerTrx = mockData.transactions.filter(t => t.clientCode === customer.customerCode && t.trxType === 'SALE')
    const totalSales = customerTrx.reduce((sum, t) => sum + t.totalAmount, 0)
    const totalOrders = customerTrx.length
    const lastOrder = customerTrx.length > 0 ? customerTrx[0].trxDate : null

    return {
      ...customer,
      totalSales,
      totalOrders,
      averageOrderValue: totalOrders > 0 ? totalSales / totalOrders : 0,
      lastOrderDate: lastOrder
    }
  }).sort((a, b) => b.totalSales - a.totalSales)
}

/**
 * Product Analytics
 */
export const getProductAnalytics = async (filters: any = {}) => {
  const productStats: any = {}

  mockData.products.forEach(product => {
    productStats[product.productCode] = {
      ...product,
      totalQuantitySold: 0,
      totalRevenue: 0,
      totalOrders: 0
    }
  })

  mockData.transactions.filter(t => t.trxType === 'SALE').forEach(t => {
    t.items.forEach((item: any) => {
      if (productStats[item.productCode]) {
        productStats[item.productCode].totalQuantitySold += item.quantity
        productStats[item.productCode].totalRevenue += item.total
        productStats[item.productCode].totalOrders += 1
      }
    })
  })

  return Object.values(productStats).sort((a: any, b: any) => b.totalRevenue - a.totalRevenue)
}

/**
 * Field Operations - Journeys
 */
export const getJourneys = async (filters: any = {}) => {
  let journeys = [...mockData.journeys]

  if (filters.startDate && filters.endDate) {
    journeys = filterByDateRange(journeys, 'journeyDate', new Date(filters.startDate), new Date(filters.endDate))
  }

  if (filters.userCode) {
    journeys = journeys.filter(j => j.userCode === filters.userCode)
  }

  if (filters.routeCode) {
    journeys = journeys.filter(j => j.routeCode === filters.routeCode)
  }

  return journeys.sort((a, b) => new Date(b.journeyDate).getTime() - new Date(a.journeyDate).getTime())
}

/**
 * Field Operations - Visits
 */
export const getVisits = async (filters: any = {}) => {
  let visits = [...mockData.visits]

  if (filters.journeyCode) {
    visits = visits.filter(v => v.journeyCode === filters.journeyCode)
  }

  if (filters.customerCode) {
    visits = visits.filter(v => v.customerCode === filters.customerCode)
  }

  return visits
}

/**
 * Returns and Wastage
 */
export const getReturnsWastage = async (filters: any = {}) => {
  let movements = [...mockData.stockMovements]

  if (filters.startDate && filters.endDate) {
    movements = filterByDateRange(movements, 'movementDate', new Date(filters.startDate), new Date(filters.endDate))
  }

  if (filters.type === 'returns') {
    movements = movements.filter(m => m.isReturn === true)
  } else if (filters.type === 'wastage') {
    movements = movements.filter(m => m.isWastage === true)
  }

  return movements.sort((a, b) => new Date(b.movementDate).getTime() - new Date(a.movementDate).getTime())
}

/**
 * Get all routes
 */
export const getRoutes = async () => {
  return mockData.routes
}

/**
 * Get all salesmen
 */
export const getSalesmen = async () => {
  return mockData.salesmen
}

/**
 * Get targets
 */
export const getTargets = async (filters: any = {}) => {
  let targets = [...mockData.targets]

  if (filters.userCode) {
    targets = targets.filter(t => t.userCode === filters.userCode)
  }

  return targets
}

/**
 * Sales Analysis Data
 */
export const getSalesAnalysis = async (filters: any = {}) => {
  const { startDate, endDate } = filters
  let transactions = [...mockData.transactions]

  if (startDate && endDate) {
    transactions = filterByDateRange(transactions, 'trxDate', new Date(startDate), new Date(endDate))
  }

  // Aggregate by various dimensions
  const bySalesman: any = {}
  const byRoute: any = {}
  const byCustomer: any = {}
  const byProduct: any = {}

  transactions.filter(t => t.trxType === 'SALE').forEach(t => {
    // By Salesman
    if (!bySalesman[t.userCode]) {
      bySalesman[t.userCode] = {
        userCode: t.userCode,
        userName: t.userName,
        totalSales: 0,
        totalOrders: 0,
        uniqueCustomers: new Set()
      }
    }
    bySalesman[t.userCode].totalSales += t.totalAmount
    bySalesman[t.userCode].totalOrders += 1
    bySalesman[t.userCode].uniqueCustomers.add(t.clientCode)

    // By Route
    if (!byRoute[t.routeCode]) {
      byRoute[t.routeCode] = {
        routeCode: t.routeCode,
        routeName: t.routeName,
        totalSales: 0,
        totalOrders: 0
      }
    }
    byRoute[t.routeCode].totalSales += t.totalAmount
    byRoute[t.routeCode].totalOrders += 1
  })

  return {
    salesBySalesman: Object.values(bySalesman).map((s: any) => ({
      ...s,
      uniqueCustomers: s.uniqueCustomers.size,
      avgOrderValue: s.totalOrders > 0 ? s.totalSales / s.totalOrders : 0
    })),
    salesByRoute: Object.values(byRoute),
    totalSales: transactions.filter(t => t.trxType === 'SALE').reduce((sum, t) => sum + t.totalAmount, 0),
    totalOrders: transactions.filter(t => t.trxType === 'SALE').length
  }
}

/**
 * Field Operations Analytics
 */
export const getFieldOperationsAnalytics = async (filters: any = {}) => {
  let journeys = [...mockData.journeys]
  let visits = [...mockData.visits]

  if (filters.startDate && filters.endDate) {
    journeys = filterByDateRange(journeys, 'journeyDate', new Date(filters.startDate), new Date(filters.endDate))
  }

  const totalJourneys = journeys.length
  const totalVisits = visits.length
  const productiveVisits = visits.filter(v => v.visitType === 1).length
  const totalSales = journeys.reduce((sum, j) => sum + j.totalSales, 0)

  return {
    totalJourneys,
    totalVisits,
    productiveVisits,
    productivityRate: totalVisits > 0 ? (productiveVisits / totalVisits * 100) : 0,
    totalSales,
    avgSalesPerJourney: totalJourneys > 0 ? totalSales / totalJourneys : 0,
    journeys: journeys.slice(0, 50),
    visits: visits.slice(0, 100)
  }
}

/**
 * Collections & Finance Data
 */
export const getCollectionsFinance = async (filters: any = {}) => {
  const transactions = mockData.transactions.filter(t => t.trxType === 'SALE')

  // Calculate outstanding amounts (mock)
  const totalInvoiced = transactions.reduce((sum, t) => sum + t.totalAmount, 0)
  const totalCollected = totalInvoiced * 0.75 // 75% collected
  const totalOutstanding = totalInvoiced - totalCollected

  const customers = mockData.customers.map(c => ({
    ...c,
    totalInvoiced: transactions.filter(t => t.clientCode === c.customerCode).reduce((sum, t) => sum + t.totalAmount, 0) || 0,
    totalCollected: (transactions.filter(t => t.clientCode === c.customerCode).reduce((sum, t) => sum + t.totalAmount, 0) || 0) * 0.75,
    outstanding: (transactions.filter(t => t.clientCode === c.customerCode).reduce((sum, t) => sum + t.totalAmount, 0) || 0) * 0.25
  }))

  return {
    summary: {
      totalInvoiced,
      totalCollected,
      totalOutstanding,
      collectionRate: (totalCollected / totalInvoiced * 100) || 0
    },
    customers: customers.sort((a, b) => b.outstanding - a.outstanding)
  }
}

/**
 * Delivery & Van Sales
 */
export const getDeliveryVanSales = async (filters: any = {}) => {
  const vanSales = mockData.transactions.filter(t => t.isVanSales && t.trxType === 'SALE')
  const totalVanSales = vanSales.reduce((sum, t) => sum + t.totalAmount, 0)
  const totalVanOrders = vanSales.length

  return {
    summary: {
      totalSales: totalVanSales,
      totalOrders: totalVanOrders,
      avgOrderValue: totalVanOrders > 0 ? totalVanSales / totalVanOrders : 0
    },
    transactions: vanSales.slice(0, 100)
  }
}

/**
 * Payment Analysis
 */
export const getPaymentAnalysis = async (filters: any = {}) => {
  const transactions = mockData.transactions.filter(t => t.trxType === 'SALE')

  const byPaymentType: any = {}
  transactions.forEach(t => {
    if (!byPaymentType[t.paymentType]) {
      byPaymentType[t.paymentType] = {
        paymentType: t.paymentType,
        totalAmount: 0,
        count: 0
      }
    }
    byPaymentType[t.paymentType].totalAmount += t.totalAmount
    byPaymentType[t.paymentType].count += 1
  })

  return {
    summary: Object.values(byPaymentType),
    transactions: transactions.slice(0, 100)
  }
}

/**
 * Category Performance
 */
export const getCategoryPerformance = async (filters: any = {}) => {
  const categoryStats: any = {}

  mockData.transactions.filter(t => t.trxType === 'SALE').forEach(t => {
    t.items.forEach((item: any) => {
      const product = mockData.products.find(p => p.productCode === item.productCode)
      const category = product?.category || 'Unknown'

      if (!categoryStats[category]) {
        categoryStats[category] = {
          category,
          totalSales: 0,
          totalQuantity: 0,
          totalOrders: 0
        }
      }
      categoryStats[category].totalSales += item.total
      categoryStats[category].totalQuantity += item.quantity
      categoryStats[category].totalOrders += 1
    })
  })

  return Object.values(categoryStats).sort((a: any, b: any) => b.totalSales - a.totalSales)
}

/**
 * Get all users
 */
export const getUsers = async () => {
  return mockData.users
}

/**
 * Get company holidays
 */
export const getHolidays = async () => {
  return mockData.holidays
}

/**
 * Get attendance records with filters
 */
export const getAttendance = async (filters: any = {}) => {
  let attendance = [...mockData.attendance]

  // Filter by date range
  if (filters.startDate && filters.endDate) {
    attendance = filterByDateRange(attendance, 'date', new Date(filters.startDate), new Date(filters.endDate))
  }

  // Filter by user
  if (filters.userCode) {
    attendance = attendance.filter(a => a.userCode === filters.userCode)
  }

  // Filter by role
  if (filters.role && filters.role !== 'all') {
    attendance = attendance.filter(a => a.role === filters.role)
  }

  // Filter by department
  if (filters.department && filters.department !== 'all') {
    attendance = attendance.filter(a => a.department === filters.department)
  }

  // Filter by status
  if (filters.status && filters.status !== 'all') {
    attendance = attendance.filter(a => a.status === filters.status)
  }

  return attendance.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
}

/**
 * Get attendance summary for a user
 */
export const getUserAttendanceSummary = async (userCode: string, filters: any = {}) => {
  const { startDate, endDate } = filters.startDate && filters.endDate
    ? { startDate: new Date(filters.startDate), endDate: new Date(filters.endDate) }
    : getDateRangeFromString('thisMonth')

  const userAttendance = filterByDateRange(
    mockData.attendance.filter(a => a.userCode === userCode),
    'date',
    startDate,
    endDate
  )

  const totalDays = userAttendance.length
  const presentDays = userAttendance.filter(a => a.status === 'Present').length
  const absentDays = userAttendance.filter(a => a.status === 'Absent').length
  const leaveDays = userAttendance.filter(a =>
    a.status.includes('Leave')
  ).length
  const weekendDays = userAttendance.filter(a => a.status === 'Weekend').length
  const holidayDays = userAttendance.filter(a => a.status === 'Holiday').length
  const lateDays = userAttendance.filter(a => a.isLate).length
  const earlyCheckoutDays = userAttendance.filter(a => a.isEarlyCheckout).length

  const totalWorkingHours = userAttendance.reduce((sum, a) => sum + (a.workingHours || 0), 0)
  const totalProductiveHours = userAttendance.reduce((sum, a) => sum + (a.productiveHours || 0), 0)
  const totalFieldHours = userAttendance.reduce((sum, a) => sum + (a.fieldHours || 0), 0)
  const totalOfficeHours = userAttendance.reduce((sum, a) => sum + (a.officeHours || 0), 0)
  const totalTravelHours = userAttendance.reduce((sum, a) => sum + (a.travelHours || 0), 0)
  const totalBreakHours = userAttendance.reduce((sum, a) => sum + (a.breakHours || 0), 0)
  const totalOvertimeHours = userAttendance.reduce((sum, a) => sum + (a.overtimeHours || 0), 0)
  const totalCustomerVisits = userAttendance.reduce((sum, a) => sum + (a.customerVisits || 0), 0)
  const totalSalesCalls = userAttendance.reduce((sum, a) => sum + (a.salesCalls || 0), 0)
  const totalDistanceTraveled = userAttendance.reduce((sum, a) => sum + (a.distanceTraveled || 0), 0)
  const totalFuelConsumed = userAttendance.reduce((sum, a) => sum + (a.fuelConsumed || 0), 0)
  const totalSalesAmount = userAttendance.reduce((sum, a) => sum + (a.salesAmount || 0), 0)
  const avgEfficiency = userAttendance.filter(a => a.efficiency > 0).reduce((sum, a) => sum + a.efficiency, 0) / Math.max(presentDays, 1)

  const workingDays = totalDays - weekendDays - holidayDays
  const attendancePercentage = workingDays > 0 ? (presentDays / workingDays) * 100 : 0

  return {
    userCode,
    totalDays,
    workingDays,
    presentDays,
    absentDays,
    leaveDays,
    weekendDays,
    holidayDays,
    lateDays,
    earlyCheckoutDays,
    attendancePercentage,
    totalWorkingHours,
    totalProductiveHours,
    totalFieldHours,
    totalOfficeHours,
    totalTravelHours,
    totalBreakHours,
    totalOvertimeHours,
    totalCustomerVisits,
    totalSalesCalls,
    totalDistanceTraveled,
    totalFuelConsumed,
    totalSalesAmount,
    avgEfficiency,
    avgWorkingHours: presentDays > 0 ? totalWorkingHours / presentDays : 0,
    avgProductiveHours: presentDays > 0 ? totalProductiveHours / presentDays : 0
  }
}

/**
 * Get attendance analytics for all users
 */
export const getAttendanceAnalytics = async (filters: any = {}) => {
  const { startDate, endDate } = filters.startDate && filters.endDate
    ? { startDate: new Date(filters.startDate), endDate: new Date(filters.endDate) }
    : getDateRangeFromString('thisMonth')

  const summaries = await Promise.all(
    mockData.users.map(user => getUserAttendanceSummary(user.userCode, { startDate, endDate }))
  )

  return summaries.map((summary, index) => ({
    ...mockData.users[index],
    ...summary
  }))
}

/**
 * Get leave balance for users
 */
export const getLeaveBalance = async (userCode?: string) => {
  if (userCode) {
    return mockData.leaveBalance.find(lb => lb.userCode === userCode)
  }
  return mockData.leaveBalance
}

/**
 * Get weekly attendance summary
 */
export const getWeeklyAttendanceSummary = async (filters: any = {}) => {
  const { startDate, endDate } = filters.startDate && filters.endDate
    ? { startDate: new Date(filters.startDate), endDate: new Date(filters.endDate) }
    : getDateRangeFromString('thisMonth')

  const attendance = filterByDateRange(mockData.attendance, 'date', startDate, endDate)

  // Group by week
  const weeklyData: any = {}

  attendance.forEach(a => {
    // Get week number
    const date = new Date(a.date)
    const weekStart = new Date(date)
    weekStart.setDate(date.getDate() - date.getDay()) // Start of week (Sunday)
    const weekKey = weekStart.toISOString().split('T')[0]

    if (!weeklyData[weekKey]) {
      weeklyData[weekKey] = {
        weekStart: weekStart,
        totalPresent: 0,
        totalAbsent: 0,
        totalLeave: 0,
        totalWorking: 0,
        totalWorkingHours: 0,
        totalProductiveHours: 0,
        totalOvertimeHours: 0
      }
    }

    if (a.status === 'Present') weeklyData[weekKey].totalPresent++
    if (a.status === 'Absent') weeklyData[weekKey].totalAbsent++
    if (a.status.includes('Leave')) weeklyData[weekKey].totalLeave++
    if (a.status !== 'Weekend' && a.status !== 'Holiday') weeklyData[weekKey].totalWorking++

    weeklyData[weekKey].totalWorkingHours += a.workingHours || 0
    weeklyData[weekKey].totalProductiveHours += a.productiveHours || 0
    weeklyData[weekKey].totalOvertimeHours += a.overtimeHours || 0
  })

  return Object.values(weeklyData).sort((a: any, b: any) =>
    new Date(a.weekStart).getTime() - new Date(b.weekStart).getTime()
  )
}

/**
 * Get monthly attendance summary
 */
export const getMonthlyAttendanceSummary = async (filters: any = {}) => {
  const { startDate, endDate } = filters.startDate && filters.endDate
    ? { startDate: new Date(filters.startDate), endDate: new Date(filters.endDate) }
    : getDateRangeFromString('thisYear')

  const attendance = filterByDateRange(mockData.attendance, 'date', startDate, endDate)

  // Group by month
  const monthlyData: any = {}

  attendance.forEach(a => {
    const date = new Date(a.date)
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`

    if (!monthlyData[monthKey]) {
      monthlyData[monthKey] = {
        month: monthKey,
        totalPresent: 0,
        totalAbsent: 0,
        totalLeave: 0,
        totalWorking: 0,
        totalWorkingHours: 0,
        totalProductiveHours: 0,
        totalOvertimeHours: 0,
        totalSalesAmount: 0
      }
    }

    if (a.status === 'Present') monthlyData[monthKey].totalPresent++
    if (a.status === 'Absent') monthlyData[monthKey].totalAbsent++
    if (a.status.includes('Leave')) monthlyData[monthKey].totalLeave++
    if (a.status !== 'Weekend' && a.status !== 'Holiday') monthlyData[monthKey].totalWorking++

    monthlyData[monthKey].totalWorkingHours += a.workingHours || 0
    monthlyData[monthKey].totalProductiveHours += a.productiveHours || 0
    monthlyData[monthKey].totalOvertimeHours += a.overtimeHours || 0
    monthlyData[monthKey].totalSalesAmount += a.salesAmount || 0
  })

  return Object.values(monthlyData).sort((a: any, b: any) => a.month.localeCompare(b.month))
}

export const mockDataService = {
  getKPIData,
  getSalesTrend,
  getTopCustomers,
  getTopProducts,
  getTransactions,
  getSalesPerformance,
  getCustomerAnalytics,
  getProductAnalytics,
  getJourneys,
  getVisits,
  getReturnsWastage,
  getRoutes,
  getSalesmen,
  getTargets,
  getSalesAnalysis,
  getFieldOperationsAnalytics,
  getCollectionsFinance,
  getDeliveryVanSales,
  getPaymentAnalysis,
  getCategoryPerformance,
  getUsers,
  getHolidays,
  getAttendance,
  getUserAttendanceSummary,
  getAttendanceAnalytics,
  getLeaveBalance,
  getWeeklyAttendanceSummary,
  getMonthlyAttendanceSummary
}

export default mockDataService
