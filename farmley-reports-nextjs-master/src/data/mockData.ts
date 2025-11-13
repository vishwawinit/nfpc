// Mock Data for Farmley Analytics
// This file contains realistic static data for all entities used in the application

// Helper function to generate dates
const getDateBefore = (days: number): Date => {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return date
}

// Helper function to generate random number in range
const random = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min

// Products - Farmley dry fruits and health foods
export const mockProducts = [
  { productCode: 'FRM001', productName: 'Premium Almonds', category: 'Nuts', brand: 'Farmley', price: 599, taxPercentage: 5, baseUOM: 'KG', salesUOM: 'KG', conversionFactor: 1, isActive: true },
  { productCode: 'FRM002', productName: 'Cashew Nuts Whole', category: 'Nuts', brand: 'Farmley', price: 699, taxPercentage: 5, baseUOM: 'KG', salesUOM: 'KG', conversionFactor: 1, isActive: true },
  { productCode: 'FRM003', productName: 'Raisins Golden', category: 'Dried Fruits', brand: 'Farmley', price: 349, taxPercentage: 5, baseUOM: 'KG', salesUOM: 'KG', conversionFactor: 1, isActive: true },
  { productCode: 'FRM004', productName: 'Dried Figs Premium', category: 'Dried Fruits', brand: 'Farmley', price: 799, taxPercentage: 5, baseUOM: 'KG', salesUOM: 'KG', conversionFactor: 1, isActive: true },
  { productCode: 'FRM005', productName: 'Dates Medjool', category: 'Dried Fruits', brand: 'Farmley', price: 899, taxPercentage: 5, baseUOM: 'KG', salesUOM: 'KG', conversionFactor: 1, isActive: true },
  { productCode: 'FRM006', productName: 'Walnuts Premium', category: 'Nuts', brand: 'Farmley', price: 749, taxPercentage: 5, baseUOM: 'KG', salesUOM: 'KG', conversionFactor: 1, isActive: true },
  { productCode: 'FRM007', productName: 'Pistachios Roasted', category: 'Nuts', brand: 'Farmley', price: 1299, taxPercentage: 5, baseUOM: 'KG', salesUOM: 'KG', conversionFactor: 1, isActive: true },
  { productCode: 'FRM008', productName: 'Trail Mix Deluxe', category: 'Mixed Nuts', brand: 'Farmley', price: 499, taxPercentage: 5, baseUOM: 'KG', salesUOM: 'KG', conversionFactor: 1, isActive: true },
  { productCode: 'FRM009', productName: 'Dried Apricots', category: 'Dried Fruits', brand: 'Farmley', price: 549, taxPercentage: 5, baseUOM: 'KG', salesUOM: 'KG', conversionFactor: 1, isActive: true },
  { productCode: 'FRM010', productName: 'Chia Seeds Organic', category: 'Seeds', brand: 'Farmley', price: 399, taxPercentage: 5, baseUOM: 'KG', salesUOM: 'KG', conversionFactor: 1, isActive: true },
  { productCode: 'FRM011', productName: 'Flax Seeds', category: 'Seeds', brand: 'Farmley', price: 299, taxPercentage: 5, baseUOM: 'KG', salesUOM: 'KG', conversionFactor: 1, isActive: true },
  { productCode: 'FRM012', productName: 'Pumpkin Seeds', category: 'Seeds', brand: 'Farmley', price: 449, taxPercentage: 5, baseUOM: 'KG', salesUOM: 'KG', conversionFactor: 1, isActive: true },
  { productCode: 'FRM013', productName: 'Dried Cranberries', category: 'Dried Fruits', brand: 'Farmley', price: 599, taxPercentage: 5, baseUOM: 'KG', salesUOM: 'KG', conversionFactor: 1, isActive: true },
  { productCode: 'FRM014', productName: 'Honey Natural', category: 'Sweeteners', brand: 'Farmley', price: 499, taxPercentage: 5, baseUOM: 'KG', salesUOM: 'KG', conversionFactor: 1, isActive: true },
  { productCode: 'FRM015', productName: 'Quinoa Seeds', category: 'Grains', brand: 'Farmley', price: 649, taxPercentage: 5, baseUOM: 'KG', salesUOM: 'KG', conversionFactor: 1, isActive: true },
  { productCode: 'FRM016', productName: 'Oats Rolled', category: 'Grains', brand: 'Farmley', price: 249, taxPercentage: 5, baseUOM: 'KG', salesUOM: 'KG', conversionFactor: 1, isActive: true },
  { productCode: 'FRM017', productName: 'Protein Mix', category: 'Health Foods', brand: 'Farmley', price: 899, taxPercentage: 5, baseUOM: 'KG', salesUOM: 'KG', conversionFactor: 1, isActive: true },
  { productCode: 'FRM018', productName: 'Dry Coconut Slices', category: 'Dried Fruits', brand: 'Farmley', price: 399, taxPercentage: 5, baseUOM: 'KG', salesUOM: 'KG', conversionFactor: 1, isActive: true },
  { productCode: 'FRM019', productName: 'Makhana Plain', category: 'Snacks', brand: 'Farmley', price: 349, taxPercentage: 5, baseUOM: 'KG', salesUOM: 'KG', conversionFactor: 1, isActive: true },
  { productCode: 'FRM020', productName: 'Mixed Berries Dried', category: 'Dried Fruits', brand: 'Farmley', price: 749, taxPercentage: 5, baseUOM: 'KG', salesUOM: 'KG', conversionFactor: 1, isActive: true },
]

// Routes - Distribution routes in UAE/Middle East
export const mockRoutes = [
  { routeCode: 'RT001', routeName: 'Dubai Downtown', regionCode: 'DXB', regionName: 'Dubai' },
  { routeCode: 'RT002', routeName: 'Dubai Marina', regionCode: 'DXB', regionName: 'Dubai' },
  { routeCode: 'RT003', routeName: 'Jumeirah District', regionCode: 'DXB', regionName: 'Dubai' },
  { routeCode: 'RT004', routeName: 'Abu Dhabi Central', regionCode: 'AUH', regionName: 'Abu Dhabi' },
  { routeCode: 'RT005', routeName: 'Sharjah Main', regionCode: 'SHJ', regionName: 'Sharjah' },
  { routeCode: 'RT006', routeName: 'Ajman City', regionCode: 'AJM', regionName: 'Ajman' },
  { routeCode: 'RT007', routeName: 'Al Ain Route', regionCode: 'ALN', regionName: 'Al Ain' },
  { routeCode: 'RT008', routeName: 'Fujairah Coast', regionCode: 'FUJ', regionName: 'Fujairah' },
]

// Salesmen/Users
export const mockSalesmen = [
  { userCode: 'SLS001', userName: 'Ahmed Hassan', routeCode: 'RT001', mobile: '+971501234567' },
  { userCode: 'SLS002', userName: 'Mohammed Ali', routeCode: 'RT002', mobile: '+971501234568' },
  { userCode: 'SLS003', userName: 'Fatima Khan', routeCode: 'RT003', mobile: '+971501234569' },
  { userCode: 'SLS004', userName: 'Omar Abdullah', routeCode: 'RT004', mobile: '+971501234570' },
  { userCode: 'SLS005', userName: 'Sara Ahmed', routeCode: 'RT005', mobile: '+971501234571' },
  { userCode: 'SLS006', userName: 'Khalid Rahman', routeCode: 'RT006', mobile: '+971501234572' },
  { userCode: 'SLS007', userName: 'Aisha Mohammed', routeCode: 'RT007', mobile: '+971501234573' },
  { userCode: 'SLS008', userName: 'Hassan Ali', routeCode: 'RT008', mobile: '+971501234574' },
]

// Customers - Retail stores, supermarkets
export const mockCustomers = [
  { customerCode: 'CUST001', customerName: 'Spinneys Dubai Mall', routeCode: 'RT001', channelCode: 'SUPERMARKET', creditLimit: 50000, outstandingAmount: 12500, status: 'Active', gpsLatitude: 25.1972, gpsLongitude: 55.2744 },
  { customerCode: 'CUST002', customerName: 'Carrefour Marina', routeCode: 'RT002', channelCode: 'HYPERMARKET', creditLimit: 100000, outstandingAmount: 25000, status: 'Active', gpsLatitude: 25.0824, gpsLongitude: 55.1395 },
  { customerCode: 'CUST003', customerName: 'Lulu Express Jumeirah', routeCode: 'RT003', channelCode: 'SUPERMARKET', creditLimit: 75000, outstandingAmount: 18000, status: 'Active', gpsLatitude: 25.2332, gpsLongitude: 55.2609 },
  { customerCode: 'CUST004', customerName: 'Union Coop Abu Dhabi', routeCode: 'RT004', channelCode: 'COOPERATIVE', creditLimit: 60000, outstandingAmount: 15000, status: 'Active', gpsLatitude: 24.4539, gpsLongitude: 54.3773 },
  { customerCode: 'CUST005', customerName: 'Choithrams Sharjah', routeCode: 'RT005', channelCode: 'SUPERMARKET', creditLimit: 45000, outstandingAmount: 10000, status: 'Active', gpsLatitude: 25.3463, gpsLongitude: 55.4209 },
  { customerCode: 'CUST006', customerName: 'West Zone Supermarket', routeCode: 'RT006', channelCode: 'SUPERMARKET', creditLimit: 35000, outstandingAmount: 8000, status: 'Active', gpsLatitude: 25.4052, gpsLongitude: 55.5137 },
  { customerCode: 'CUST007', customerName: 'Al Maya Supermarket', routeCode: 'RT007', channelCode: 'SUPERMARKET', creditLimit: 40000, outstandingAmount: 9500, status: 'Active', gpsLatitude: 24.2075, gpsLongitude: 55.7447 },
  { customerCode: 'CUST008', customerName: 'Day to Day Fujairah', routeCode: 'RT008', channelCode: 'MINIMARKET', creditLimit: 25000, outstandingAmount: 5000, status: 'Active', gpsLatitude: 25.1288, gpsLongitude: 56.3265 },
  { customerCode: 'CUST009', customerName: 'Grandiose Supermarket', routeCode: 'RT001', channelCode: 'SUPERMARKET', creditLimit: 55000, outstandingAmount: 13000, status: 'Active', gpsLatitude: 25.2048, gpsLongitude: 55.2708 },
  { customerCode: 'CUST010', customerName: 'Nesto Hypermarket', routeCode: 'RT002', channelCode: 'HYPERMARKET', creditLimit: 90000, outstandingAmount: 22000, status: 'Active', gpsLatitude: 25.0752, gpsLongitude: 55.1329 },
  { customerCode: 'CUST011', customerName: 'Waitrose Dubai', routeCode: 'RT001', channelCode: 'SUPERMARKET', creditLimit: 70000, outstandingAmount: 17500, status: 'Active', gpsLatitude: 25.2084, gpsLongitude: 55.2719 },
  { customerCode: 'CUST012', customerName: 'Viva Supermarket', routeCode: 'RT003', channelCode: 'SUPERMARKET', creditLimit: 48000, outstandingAmount: 11000, status: 'Active', gpsLatitude: 25.2422, gpsLongitude: 55.2866 },
  { customerCode: 'CUST013', customerName: 'Geant Abu Dhabi', routeCode: 'RT004', channelCode: 'HYPERMARKET', creditLimit: 85000, outstandingAmount: 20000, status: 'Active', gpsLatitude: 24.4667, gpsLongitude: 54.3667 },
  { customerCode: 'CUST014', customerName: 'Safeer Mall Sharjah', routeCode: 'RT005', channelCode: 'SUPERMARKET', creditLimit: 42000, outstandingAmount: 9800, status: 'Active', gpsLatitude: 25.3574, gpsLongitude: 55.3916 },
  { customerCode: 'CUST015', customerName: 'Al Madina Hypermarket', routeCode: 'RT006', channelCode: 'HYPERMARKET', creditLimit: 65000, outstandingAmount: 14500, status: 'Active', gpsLatitude: 25.4211, gpsLongitude: 55.5136 },
]

// Generate transactions for the last 90 days
export const generateMockTransactions = () => {
  const transactions: any[] = []
  let trxCounter = 1000

  // Generate transactions for last 90 days
  for (let day = 0; day < 90; day++) {
    const date = getDateBefore(day)
    const numTransactions = random(15, 35) // 15-35 transactions per day

    for (let i = 0; i < numTransactions; i++) {
      const customer = mockCustomers[random(0, mockCustomers.length - 1)]
      const salesman = mockSalesmen.find(s => s.routeCode === customer.routeCode) || mockSalesmen[0]
      const route = mockRoutes.find(r => r.routeCode === customer.routeCode) || mockRoutes[0]

      // Random transaction details
      const numItems = random(2, 8)
      const isReturn = random(1, 20) === 1 // 5% chance of return
      const paymentType = random(1, 3) // 1=Cash, 2=Credit, 3=Card

      let totalAmount = 0
      const items: any[] = []

      for (let j = 0; j < numItems; j++) {
        const product = mockProducts[random(0, mockProducts.length - 1)]
        const quantity = random(1, 10)
        const itemTotal = product.price * quantity
        totalAmount += itemTotal

        items.push({
          productCode: product.productCode,
          productName: product.productName,
          quantity,
          price: product.price,
          total: itemTotal
        })
      }

      const discountPercent = random(0, 15)
      const discountAmount = (totalAmount * discountPercent) / 100
      const taxAmount = ((totalAmount - discountAmount) * 5) / 100 // 5% VAT
      const finalAmount = totalAmount - discountAmount + taxAmount

      transactions.push({
        trxCode: `TRX${String(trxCounter++).padStart(6, '0')}`,
        appTrxId: `APP${String(trxCounter).padStart(8, '0')}`,
        orgCode: 'FARMLEY',
        journeyCode: `JRN${String(day).padStart(3, '0')}${salesman.userCode}`,
        visitCode: `VST${String(day).padStart(3, '0')}${customer.customerCode}`,
        userCode: salesman.userCode,
        userName: salesman.userName,
        clientCode: customer.customerCode,
        clientName: customer.customerName,
        trxDate: date,
        trx_date: date, // Alternative field name
        trxDateOnly: date.toISOString().split('T')[0],
        trx_date_only: date.toISOString().split('T')[0],
        trxType: isReturn ? 'RETURN' : 'SALE',
        trx_type: isReturn ? 3 : 1, // 1=Sale, 3=Return
        paymentType: paymentType === 1 ? 'CASH' : paymentType === 2 ? 'CREDIT' : 'CARD',
        payment_type: paymentType,
        totalAmount: isReturn ? -finalAmount : finalAmount,
        total_amount: isReturn ? -finalAmount : finalAmount,
        totalDiscountAmount: discountAmount,
        totalTaxAmount: taxAmount,
        status: 5, // 5=Paid/Completed
        isVanSales: random(1, 5) === 1, // 20% van sales
        routeCode: route.routeCode,
        routeName: route.routeName,
        region_code: route.regionCode,
        region_name: route.regionName,
        customer_code: customer.customerCode,
        items: items
      })
    }
  }

  return transactions
}

export const mockTransactions = generateMockTransactions()

// Generate daily sales aggregates
export const generateDailySales = () => {
  const dailySales: any[] = []

  for (let day = 0; day < 90; day++) {
    const date = getDateBefore(day)
    const dayTransactions = mockTransactions.filter(t =>
      new Date(t.trxDate).toISOString().split('T')[0] === date.toISOString().split('T')[0]
    )

    const salesTransactions = dayTransactions.filter(t => t.trxType === 'SALE')
    const returnTransactions = dayTransactions.filter(t => t.trxType === 'RETURN')

    const totalSales = salesTransactions.reduce((sum, t) => sum + t.totalAmount, 0)
    const totalReturns = Math.abs(returnTransactions.reduce((sum, t) => sum + t.totalAmount, 0))
    const totalTransactions = salesTransactions.length
    const totalCustomers = new Set(salesTransactions.map(t => t.clientCode)).size

    dailySales.push({
      sale_date: date.toISOString().split('T')[0],
      saleDate: date,
      total_sales: totalSales,
      totalSales: totalSales,
      total_transactions: totalTransactions,
      totalTransactions: totalTransactions,
      total_customers: totalCustomers,
      totalCustomers: totalCustomers,
      total_returns: totalReturns,
      totalReturns: totalReturns,
      net_sales: totalSales - totalReturns,
      netSales: totalSales - totalReturns
    })
  }

  return dailySales
}

export const mockDailySales = generateDailySales()

// Generate stock movements (returns, wastage)
export const generateStockMovements = () => {
  const movements: any[] = []
  let movementCounter = 1

  const returnTransactions = mockTransactions.filter(t => t.trxType === 'RETURN')

  returnTransactions.forEach(trx => {
    trx.items.forEach((item: any) => {
      movements.push({
        movement_code: `MOV${String(movementCounter++).padStart(6, '0')}`,
        movement_date: trx.trxDate,
        movementDate: trx.trxDate,
        product_code: item.productCode,
        productCode: item.productCode,
        product_name: item.productName,
        productName: item.productName,
        quantity: -item.quantity,
        is_return: true,
        isReturn: true,
        return_value: item.total,
        returnValue: item.total,
        customer_code: trx.clientCode,
        salesman_code: trx.userCode,
        route_code: trx.routeCode,
        reason: random(1, 3) === 1 ? 'Damaged' : random(1, 2) === 1 ? 'Expired' : 'Customer Return'
      })
    })
  })

  // Add some wastage entries
  for (let day = 0; day < 90; day++) {
    if (random(1, 5) === 1) { // 20% chance of wastage on a day
      const date = getDateBefore(day)
      const product = mockProducts[random(0, mockProducts.length - 1)]
      const quantity = random(1, 5)

      movements.push({
        movement_code: `MOV${String(movementCounter++).padStart(6, '0')}`,
        movement_date: date,
        movementDate: date,
        product_code: product.productCode,
        productCode: product.productCode,
        product_name: product.productName,
        productName: product.productName,
        quantity: -quantity,
        is_return: false,
        isReturn: false,
        is_wastage: true,
        isWastage: true,
        wastage_value: product.price * quantity,
        wastageValue: product.price * quantity,
        reason: random(1, 2) === 1 ? 'Expired' : 'Damaged in Transit'
      })
    }
  }

  return movements
}

export const mockStockMovements = generateStockMovements()

// Generate journeys (field operations)
export const generateJourneys = () => {
  const journeys: any[] = []

  for (let day = 0; day < 90; day++) {
    const date = getDateBefore(day)

    mockSalesmen.forEach((salesman, idx) => {
      // Not all salesmen work every day
      if (random(1, 7) <= 5) { // 5/7 days working
        const startHour = random(7, 9)
        const endHour = random(16, 18)
        const startTime = new Date(date)
        startTime.setHours(startHour, random(0, 59), 0)
        const endTime = new Date(date)
        endTime.setHours(endHour, random(0, 59), 0)

        const numVisits = random(8, 15)
        const productiveVisits = random(6, numVisits)
        const daySales = mockTransactions.filter(t =>
          t.userCode === salesman.userCode &&
          new Date(t.trxDate).toISOString().split('T')[0] === date.toISOString().split('T')[0]
        )
        const totalSales = daySales.reduce((sum, t) => sum + (t.trxType === 'SALE' ? t.totalAmount : 0), 0)

        journeys.push({
          journey_code: `JRN${String(day).padStart(3, '0')}${salesman.userCode}`,
          journeyCode: `JRN${String(day).padStart(3, '0')}${salesman.userCode}`,
          user_code: salesman.userCode,
          userCode: salesman.userCode,
          user_name: salesman.userName,
          userName: salesman.userName,
          route_code: salesman.routeCode,
          routeCode: salesman.routeCode,
          route_name: mockRoutes.find(r => r.routeCode === salesman.routeCode)?.routeName,
          routeName: mockRoutes.find(r => r.routeCode === salesman.routeCode)?.routeName,
          journey_date: date,
          journeyDate: date,
          start_time: startTime,
          startTime: startTime,
          end_time: endTime,
          endTime: endTime,
          start_odometer: random(5000, 50000),
          end_odometer: random(50100, 50500),
          total_visits: numVisits,
          totalVisits: numVisits,
          productive_visits: productiveVisits,
          productiveVisits: productiveVisits,
          total_sales: totalSales,
          totalSales: totalSales,
          status: 'COMPLETED'
        })
      }
    })
  }

  return journeys
}

export const mockJourneys = generateJourneys()

// Generate visits
export const generateVisits = () => {
  const visits: any[] = []
  let visitCounter = 1

  mockJourneys.forEach(journey => {
    const journeyCustomers = mockCustomers.filter(c => c.routeCode === journey.routeCode)
    const numVisits = journey.totalVisits

    for (let i = 0; i < numVisits; i++) {
      const customer = journeyCustomers[random(0, journeyCustomers.length - 1)]
      const checkInTime = new Date(journey.startTime)
      checkInTime.setMinutes(checkInTime.getMinutes() + (i * 30))
      const checkOutTime = new Date(checkInTime)
      checkOutTime.setMinutes(checkOutTime.getMinutes() + random(10, 45))

      const isProductive = i < journey.productiveVisits
      const visitSales = isProductive ? random(500, 5000) : 0

      visits.push({
        visit_id: `VST${String(visitCounter++).padStart(6, '0')}`,
        visitId: `VST${String(visitCounter).padStart(6, '0')}`,
        journey_code: journey.journeyCode,
        journeyCode: journey.journeyCode,
        customer_code: customer.customerCode,
        customerCode: customer.customerCode,
        customer_name: customer.customerName,
        customerName: customer.customerName,
        check_in_time: checkInTime,
        checkInTime: checkInTime,
        check_out_time: checkOutTime,
        checkOutTime: checkOutTime,
        visit_duration: Math.round((checkOutTime.getTime() - checkInTime.getTime()) / 60000),
        visitDuration: Math.round((checkOutTime.getTime() - checkInTime.getTime()) / 60000),
        visit_type: isProductive ? 1 : 2,
        visitType: isProductive ? 1 : 2,
        sales_amount: visitSales,
        salesAmount: visitSales,
        gps_latitude: customer.gpsLatitude,
        gpsLatitude: customer.gpsLatitude,
        gps_longitude: customer.gpsLongitude,
        gpsLongitude: customer.gpsLongitude
      })
    }
  })

  return visits
}

export const mockVisits = generateVisits()

// Generate targets
export const generateTargets = () => {
  const targets: any[] = []

  mockSalesmen.forEach(salesman => {
    // Monthly target for last 3 months
    for (let month = 0; month < 3; month++) {
      const startDate = new Date()
      startDate.setMonth(startDate.getMonth() - month)
      startDate.setDate(1)
      const endDate = new Date(startDate)
      endDate.setMonth(endDate.getMonth() + 1)
      endDate.setDate(0)

      const targetAmount = random(80000, 150000)
      const salesmanSales = mockTransactions.filter(t =>
        t.userCode === salesman.userCode &&
        new Date(t.trxDate) >= startDate &&
        new Date(t.trxDate) <= endDate &&
        t.trxType === 'SALE'
      )
      const achievedAmount = salesmanSales.reduce((sum, t) => sum + t.totalAmount, 0)
      const achievementPercentage = (achievedAmount / targetAmount) * 100

      targets.push({
        target_code: `TGT${salesman.userCode}${startDate.getMonth() + 1}`,
        targetCode: `TGT${salesman.userCode}${startDate.getMonth() + 1}`,
        user_code: salesman.userCode,
        userCode: salesman.userCode,
        user_name: salesman.userName,
        userName: salesman.userName,
        period_type: 'Monthly',
        periodType: 'Monthly',
        start_date: startDate,
        startDate: startDate,
        end_date: endDate,
        endDate: endDate,
        target_amount: targetAmount,
        targetAmount: targetAmount,
        achieved_amount: achievedAmount,
        achievedAmount: achievedAmount,
        achievement_percentage: achievementPercentage,
        achievementPercentage: achievementPercentage,
        status: achievementPercentage >= 100 ? 'Achieved' : achievementPercentage >= 80 ? 'On Track' : achievementPercentage >= 60 ? 'Behind' : 'Critical'
      })
    }
  })

  return targets
}

export const mockTargets = generateTargets()

// ============= ATTENDANCE DATA =============

// User roles and departments
export const mockUsers = [
  { userCode: 'USR001', userName: 'Ahmed Hassan', role: 'Team Leader', department: 'Sales', email: 'ahmed.hassan@farmley.com', mobile: '+971501234567', joinDate: new Date(2022, 0, 15), isActive: true },
  { userCode: 'USR002', userName: 'Mohammed Ali', role: 'Assistant Team Leader', department: 'Sales', email: 'mohammed.ali@farmley.com', mobile: '+971501234568', joinDate: new Date(2022, 2, 20), isActive: true },
  { userCode: 'USR003', userName: 'Fatima Khan', role: 'Sales Executive', department: 'Sales', email: 'fatima.khan@farmley.com', mobile: '+971501234569', joinDate: new Date(2022, 5, 10), isActive: true },
  { userCode: 'USR004', userName: 'Omar Abdullah', role: 'Sales Executive', department: 'Sales', email: 'omar.abdullah@farmley.com', mobile: '+971501234570', joinDate: new Date(2022, 7, 5), isActive: true },
  { userCode: 'USR005', userName: 'Sara Ahmed', role: 'Sales Executive', department: 'Sales', email: 'sara.ahmed@farmley.com', mobile: '+971501234571', joinDate: new Date(2023, 1, 12), isActive: true },
  { userCode: 'USR006', userName: 'Khalid Rahman', role: 'Sales Executive', department: 'Sales', email: 'khalid.rahman@farmley.com', mobile: '+971501234572', joinDate: new Date(2023, 3, 18), isActive: true },
  { userCode: 'USR007', userName: 'Aisha Mohammed', role: 'Team Leader', department: 'Operations', email: 'aisha.mohammed@farmley.com', mobile: '+971501234573', joinDate: new Date(2021, 10, 8), isActive: true },
  { userCode: 'USR008', userName: 'Hassan Ali', role: 'Assistant Team Leader', department: 'Operations', email: 'hassan.ali@farmley.com', mobile: '+971501234574', joinDate: new Date(2022, 4, 25), isActive: true },
  { userCode: 'USR009', userName: 'Layla Ibrahim', role: 'Operations Executive', department: 'Operations', email: 'layla.ibrahim@farmley.com', mobile: '+971501234575', joinDate: new Date(2023, 0, 14), isActive: true },
  { userCode: 'USR010', userName: 'Youssef Malik', role: 'Operations Executive', department: 'Operations', email: 'youssef.malik@farmley.com', mobile: '+971501234576', joinDate: new Date(2023, 2, 22), isActive: true },
  { userCode: 'USR011', userName: 'Noor Hassan', role: 'HR Manager', department: 'HR', email: 'noor.hassan@farmley.com', mobile: '+971501234577', joinDate: new Date(2021, 8, 10), isActive: true },
  { userCode: 'USR012', userName: 'Rashid Ahmed', role: 'Finance Manager', department: 'Finance', email: 'rashid.ahmed@farmley.com', mobile: '+971501234578', joinDate: new Date(2021, 11, 5), isActive: true },
]

// Company holidays for 2024
export const mockHolidays = [
  { date: new Date(2024, 0, 1), name: 'New Year Day', type: 'Public Holiday' },
  { date: new Date(2024, 3, 10), name: 'Eid al-Fitr', type: 'Public Holiday' },
  { date: new Date(2024, 3, 11), name: 'Eid al-Fitr Holiday', type: 'Public Holiday' },
  { date: new Date(2024, 3, 12), name: 'Eid al-Fitr Holiday', type: 'Public Holiday' },
  { date: new Date(2024, 5, 15), name: 'Arafat Day', type: 'Public Holiday' },
  { date: new Date(2024, 5, 16), name: 'Eid al-Adha', type: 'Public Holiday' },
  { date: new Date(2024, 5, 17), name: 'Eid al-Adha Holiday', type: 'Public Holiday' },
  { date: new Date(2024, 5, 18), name: 'Eid al-Adha Holiday', type: 'Public Holiday' },
  { date: new Date(2024, 6, 7), name: 'Islamic New Year', type: 'Public Holiday' },
  { date: new Date(2024, 8, 16), name: 'Prophet\'s Birthday', type: 'Public Holiday' },
  { date: new Date(2024, 11, 2), name: 'National Day', type: 'Public Holiday' },
  { date: new Date(2024, 11, 3), name: 'National Day Holiday', type: 'Public Holiday' },
]

// Generate attendance records for last 90 days
export const generateAttendanceRecords = () => {
  const attendance: any[] = []

  for (let day = 0; day < 90; day++) {
    const date = getDateBefore(day)
    const dayOfWeek = date.getDay() // 0 = Sunday, 6 = Saturday

    // Check if it's a weekend (Friday/Saturday in UAE)
    const isWeekend = dayOfWeek === 5 || dayOfWeek === 6

    // Check if it's a holiday
    const isHoliday = mockHolidays.some(h =>
      h.date.toISOString().split('T')[0] === date.toISOString().split('T')[0]
    )

    mockUsers.forEach(user => {
      // Skip weekends and holidays
      if (isWeekend || isHoliday) {
        attendance.push({
          attendanceId: `ATT${user.userCode}${date.toISOString().split('T')[0].replace(/-/g, '')}`,
          userCode: user.userCode,
          userName: user.userName,
          role: user.role,
          department: user.department,
          date: date,
          dateString: date.toISOString().split('T')[0],
          dayOfWeek: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayOfWeek],
          status: isHoliday ? 'Holiday' : 'Weekend',
          checkIn: null,
          checkOut: null,
          workingHours: 0,
          isLate: false,
          isEarlyCheckout: false,
          remarks: isHoliday ? mockHolidays.find(h => h.date.toISOString().split('T')[0] === date.toISOString().split('T')[0])?.name : 'Weekend'
        })
        return
      }

      // Determine attendance status (90% present, 5% leave, 5% absent)
      const rand = random(1, 100)
      let status = 'Present'
      let checkIn = null
      let checkOut = null
      let workingHours = 0
      let isLate = false
      let isEarlyCheckout = false
      let remarks = ''

      // Additional metrics
      let productiveHours = 0
      let fieldHours = 0
      let officeHours = 0
      let travelHours = 0
      let breakHours = 0
      let idleHours = 0
      let overtimeHours = 0
      let customerVisits = 0
      let salesCalls = 0
      let distanceTraveled = 0
      let fuelConsumed = 0
      let salesAmount = 0
      let targetAchievement = 0
      let efficiency = 0
      let location = ''

      if (rand <= 5) {
        status = 'Absent'
        remarks = 'Absent without notice'
      } else if (rand <= 10) {
        // Leave
        const leaveTypes = ['Sick Leave', 'Casual Leave', 'Annual Leave', 'Emergency Leave']
        status = leaveTypes[random(0, leaveTypes.length - 1)]
        remarks = `${status} approved`
      } else {
        // Present
        status = 'Present'

        // Check-in time (8:00 AM - 9:30 AM)
        const checkInHour = random(8, 9)
        const checkInMinute = checkInHour === 9 ? random(0, 30) : random(0, 59)
        checkIn = new Date(date)
        checkIn.setHours(checkInHour, checkInMinute, 0)

        // Check if late (after 9:00 AM)
        isLate = checkInHour > 9 || (checkInHour === 9 && checkInMinute > 0)

        // Check-out time (5:00 PM - 6:30 PM)
        const checkOutHour = random(17, 18)
        const checkOutMinute = checkOutHour === 18 ? random(0, 30) : random(0, 59)
        checkOut = new Date(date)
        checkOut.setHours(checkOutHour, checkOutMinute, 0)

        // Check if early checkout (before 5:00 PM)
        isEarlyCheckout = checkOutHour < 17

        // Calculate working hours
        workingHours = (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60)

        // For Sales department, calculate field metrics
        if (user.department === 'Sales') {
          // Field hours (60-80% of working hours)
          fieldHours = workingHours * (random(60, 80) / 100)
          officeHours = workingHours - fieldHours

          // Travel hours (20-30% of working hours)
          travelHours = workingHours * (random(20, 30) / 100)

          // Break hours (1-1.5 hours)
          breakHours = random(10, 15) / 10

          // Productive hours (actual work time)
          productiveHours = workingHours - travelHours - breakHours

          // Idle hours
          idleHours = workingHours * (random(5, 15) / 100)

          // Customer visits (8-15 per day)
          customerVisits = random(8, 15)

          // Sales calls (5-12 per day)
          salesCalls = random(5, 12)

          // Distance traveled (50-200 km)
          distanceTraveled = random(50, 200)

          // Fuel consumed (based on distance, 8-12 km per liter)
          fuelConsumed = distanceTraveled / random(8, 12)

          // Sales amount (2000-15000 AED)
          salesAmount = random(2000, 15000)

          // Target achievement (60-120%)
          targetAchievement = random(60, 120)

          // Efficiency (productive hours / working hours * 100)
          efficiency = (productiveHours / workingHours) * 100

          // Location (check in location)
          const locations = ['Dubai Downtown', 'Dubai Marina', 'Jumeirah', 'Abu Dhabi Central', 'Sharjah Main']
          location = locations[random(0, locations.length - 1)]

        } else {
          // For non-sales (office work)
          officeHours = workingHours
          fieldHours = 0
          travelHours = 0
          breakHours = random(10, 15) / 10
          productiveHours = workingHours - breakHours
          idleHours = workingHours * (random(10, 20) / 100)
          efficiency = (productiveHours / workingHours) * 100
          location = 'Head Office'
          customerVisits = 0
          salesCalls = 0
          distanceTraveled = 0
          fuelConsumed = 0
          salesAmount = 0
          targetAchievement = 0
        }

        // Overtime hours (20% chance)
        if (random(1, 5) === 1) {
          overtimeHours = random(1, 3)
          workingHours += overtimeHours
        }

        if (isLate && isEarlyCheckout) {
          remarks = 'Late arrival and early departure'
        } else if (isLate) {
          remarks = `Late by ${checkInMinute} minutes`
        } else if (isEarlyCheckout) {
          remarks = 'Early checkout'
        } else {
          remarks = 'On time'
        }
      }

      attendance.push({
        attendanceId: `ATT${user.userCode}${date.toISOString().split('T')[0].replace(/-/g, '')}`,
        userCode: user.userCode,
        userName: user.userName,
        role: user.role,
        department: user.department,
        date: date,
        dateString: date.toISOString().split('T')[0],
        dayOfWeek: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayOfWeek],
        status: status,
        checkIn: checkIn,
        checkOut: checkOut,
        workingHours: parseFloat(workingHours.toFixed(2)),
        productiveHours: parseFloat(productiveHours.toFixed(2)),
        fieldHours: parseFloat(fieldHours.toFixed(2)),
        officeHours: parseFloat(officeHours.toFixed(2)),
        travelHours: parseFloat(travelHours.toFixed(2)),
        breakHours: parseFloat(breakHours.toFixed(2)),
        idleHours: parseFloat(idleHours.toFixed(2)),
        overtimeHours: parseFloat(overtimeHours.toFixed(2)),
        customerVisits: customerVisits,
        salesCalls: salesCalls,
        distanceTraveled: parseFloat(distanceTraveled.toFixed(2)),
        fuelConsumed: parseFloat(fuelConsumed.toFixed(2)),
        salesAmount: parseFloat(salesAmount.toFixed(2)),
        targetAchievement: parseFloat(targetAchievement.toFixed(2)),
        efficiency: parseFloat(efficiency.toFixed(2)),
        location: location,
        isLate: isLate,
        isEarlyCheckout: isEarlyCheckout,
        remarks: remarks
      })
    })
  }

  return attendance
}

export const mockAttendance = generateAttendanceRecords()

// Generate leave balance for each user
export const generateLeaveBalance = () => {
  return mockUsers.map(user => {
    const userAttendance = mockAttendance.filter(a => a.userCode === user.userCode)
    const sickLeave = userAttendance.filter(a => a.status === 'Sick Leave').length
    const casualLeave = userAttendance.filter(a => a.status === 'Casual Leave').length
    const annualLeave = userAttendance.filter(a => a.status === 'Annual Leave').length
    const emergencyLeave = userAttendance.filter(a => a.status === 'Emergency Leave').length

    return {
      userCode: user.userCode,
      userName: user.userName,
      role: user.role,
      department: user.department,
      sickLeaveTotal: 15,
      sickLeaveUsed: sickLeave,
      sickLeaveBalance: 15 - sickLeave,
      casualLeaveTotal: 10,
      casualLeaveUsed: casualLeave,
      casualLeaveBalance: 10 - casualLeave,
      annualLeaveTotal: 30,
      annualLeaveUsed: annualLeave,
      annualLeaveBalance: 30 - annualLeave,
      emergencyLeaveTotal: 5,
      emergencyLeaveUsed: emergencyLeave,
      emergencyLeaveBalance: 5 - emergencyLeave,
    }
  })
}

export const mockLeaveBalance = generateLeaveBalance()

// Export all data
export const mockData = {
  products: mockProducts,
  routes: mockRoutes,
  salesmen: mockSalesmen,
  customers: mockCustomers,
  transactions: mockTransactions,
  dailySales: mockDailySales,
  stockMovements: mockStockMovements,
  journeys: mockJourneys,
  visits: mockVisits,
  targets: mockTargets,
  users: mockUsers,
  holidays: mockHolidays,
  attendance: mockAttendance,
  leaveBalance: mockLeaveBalance
}

export default mockData
