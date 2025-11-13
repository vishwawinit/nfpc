import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'
import { unstable_cache } from 'next/cache'

// Cached data fetcher - 5 minute cache to reduce DB load
const getCachedExcelSheetData = unstable_cache(
  async (date: string) => {
    await db.initialize()

    console.log('📊 ExcelSheet API: Fetching consolidated data for date:', date)

    // Calculate month-to-date range
    const selectedDateObj = new Date(date)
    const year = selectedDateObj.getFullYear()
    const month = selectedDateObj.getMonth() + 1
    const startOfMonth = `${year}-${month.toString().padStart(2, '0')}-01`

    console.log('📊 ExcelSheet API: Date range - Day:', date, '| MTD:', startOfMonth, 'to', date)

    // Salesmen codes that have targets in the system
    const SALESMEN_WITH_TARGETS = [
      '10408', '10840', '13227', '14761', '15180', '15771', '15924', '16246', '16310', '16325',
      '16327', '16501', '17721', '17830', '18411', '19364', '19435', '19769', '20070', '20170',
      '20183', '20197', '20354', '20629', '20657', '20659', '20700', '20763', '20782', '20785',
      '20848', '21009', '21038', '21056', '21194', '21256', '21257', '21332', '21609', '21685'
    ]

    // Get comprehensive KPI data from multiple flat tables in parallel
    const [salesmenResult, salesmenMTDResult, routesResult, transactionsResult, visitsResult, visitsMTDResult, paymentsResult, paymentsMTDResult, skuDayResult, skuMTDResult] = await Promise.all([
      // 1. Get salesman performance data - DAILY
      db.query(`
        SELECT DISTINCT
          t.salesman_code,
          t.salesman_name,
          t.route_code,
          COUNT(DISTINCT t.trx_code) as total_orders,
          COUNT(DISTINCT t.customer_code) as unique_customers,
          SUM(t.total_amount) as total_sales,
          AVG(t.total_amount) as avg_order_value,
          COUNT(DISTINCT t.product_code) as unique_products,
          MIN(t.trx_date) as first_transaction,
          MAX(t.trx_date) as last_transaction
        FROM new_flat_transactions t
        WHERE t.trx_date_only = $1
          AND t.salesman_code IS NOT NULL
          AND t.salesman_name IS NOT NULL
          AND t.route_code IS NOT NULL
          AND t.total_amount > 0
        GROUP BY t.salesman_code, t.salesman_name, t.route_code
        ORDER BY total_sales DESC
      `, [date]),

      // 1.1. Get salesman performance data - MONTH-TO-DATE
      db.query(`
        SELECT DISTINCT
          t.salesman_code,
          t.salesman_name,
          COUNT(DISTINCT t.trx_code) as mtd_total_orders,
          COUNT(DISTINCT t.customer_code) as mtd_unique_customers,
          SUM(t.total_amount) as mtd_total_sales,
          AVG(t.total_amount) as mtd_avg_order_value,
          COUNT(DISTINCT t.product_code) as mtd_unique_products,
          MIN(t.trx_date) as mtd_first_transaction,
          MAX(t.trx_date) as mtd_last_transaction
        FROM new_flat_transactions t
        WHERE t.trx_date_only >= $1 AND t.trx_date_only <= $2
          AND t.salesman_code IS NOT NULL
          AND t.salesman_name IS NOT NULL
          AND t.total_amount > 0
        GROUP BY t.salesman_code, t.salesman_name
        ORDER BY mtd_total_sales DESC
      `, [startOfMonth, date]),

      // 2. Get route performance data with better customer counts
      db.query(`
        WITH route_customers AS (
          -- Get historical customer base for each route (last 30 days)
          SELECT
            t.route_code,
            COUNT(DISTINCT t.customer_code) as historical_customers
          FROM new_flat_transactions t
          WHERE t.trx_date_only >= $1::date - INTERVAL '30 days'
            AND t.trx_date_only <= $1::date
            AND t.route_code IS NOT NULL
          GROUP BY t.route_code
        ),
        today_data AS (
          SELECT DISTINCT
            t.route_code,
            COUNT(DISTINCT t.salesman_code) as assigned_salesmen,
            COUNT(DISTINCT t.customer_code) as total_customers,
            COUNT(DISTINCT t.trx_code) as total_orders,
            SUM(t.total_amount) as route_sales,
            COUNT(DISTINCT t.product_code) as products_sold
          FROM new_flat_transactions t
          WHERE t.trx_date_only = $1
            AND t.route_code IS NOT NULL
            AND t.total_amount > 0
          GROUP BY t.route_code
        )
        SELECT
          t.*,
          COALESCE(r.historical_customers, t.total_customers) as planned_customers
        FROM today_data t
        LEFT JOIN route_customers r ON t.route_code = r.route_code
        ORDER BY t.route_sales DESC
      `, [date]),

      // 3. Get transaction summary for the date
      db.query(`
        SELECT
          COUNT(DISTINCT trx_code) as total_transactions,
          SUM(total_amount) as total_sales_amount,
          COUNT(DISTINCT customer_code) as total_customers,
          COUNT(DISTINCT salesman_code) as active_salesmen,
          COUNT(DISTINCT route_code) as active_routes,
          AVG(total_amount) as avg_transaction_value
        FROM new_flat_transactions
        WHERE trx_date_only = $1
          AND total_amount > 0
      `, [date]),

      // 4. Get visit data - DAILY
      db.query(`
        SELECT
          v.salesman_code,
          v.salesman_name,
          COUNT(*) as total_visits,
          COUNT(CASE WHEN v.is_productive = true THEN 1 END) as productive_visits,
          AVG(v.duration_minutes) as avg_visit_duration,
          COUNT(DISTINCT v.customer_code) as customers_visited
        FROM new_flat_customer_visits v
        WHERE v.visit_date = $1
          AND v.salesman_code IS NOT NULL
        GROUP BY v.salesman_code, v.salesman_name
      `, [date]),

      // 4.1 Get visit data - MTD
      db.query(`
        SELECT
          v.salesman_code,
          v.salesman_name,
          COUNT(*) as mtd_total_visits,
          COUNT(CASE WHEN v.is_productive = true THEN 1 END) as mtd_productive_visits,
          AVG(v.duration_minutes) as mtd_avg_visit_duration,
          COUNT(DISTINCT v.customer_code) as mtd_customers_visited
        FROM new_flat_customer_visits v
        WHERE v.visit_date >= $1 AND v.visit_date <= $2
          AND v.salesman_code IS NOT NULL
        GROUP BY v.salesman_code, v.salesman_name
      `, [startOfMonth, date]),

      // 5. Get payments/collections data - DAILY
      db.query(`
        SELECT
          p.salesman_code,
          p.salesman_name,
          COUNT(*) as total_collections,
          SUM(p.total_amount) as total_collected,
          AVG(p.total_amount) as avg_collection_amount
        FROM new_flat_payments p
        WHERE p.payment_date = $1
          AND p.salesman_code IS NOT NULL
          AND p.total_amount > 0
        GROUP BY p.salesman_code, p.salesman_name
      `, [date]),

      // 6. Get payments/collections data - MTD
      db.query(`
        SELECT
          p.salesman_code,
          p.salesman_name,
          COUNT(*) as mtd_total_collections,
          SUM(p.total_amount) as mtd_total_collected,
          AVG(p.total_amount) as mtd_avg_collection_amount
        FROM new_flat_payments p
        WHERE p.payment_date >= $1 AND p.payment_date <= $2
          AND p.salesman_code IS NOT NULL
          AND p.total_amount > 0
        GROUP BY p.salesman_code, p.salesman_name
      `, [startOfMonth, date]),

      // 7. Get SKU-level sales data - DAILY (for Top 10 / Last 5 SKU contribution)
      db.query(`
        SELECT
          t.salesman_code,
          t.product_code,
          t.product_name,
          SUM(t.total_amount) as product_sales,
          SUM(t.quantity) as product_quantity
        FROM new_flat_transactions t
        WHERE t.trx_date_only = $1
          AND t.salesman_code IS NOT NULL
          AND t.product_code IS NOT NULL
          AND t.total_amount > 0
        GROUP BY t.salesman_code, t.product_code, t.product_name
        ORDER BY t.salesman_code, product_sales DESC
      `, [date]),

      // 8. Get SKU-level sales data - MTD (for Top 10 / Last 5 SKU contribution)
      db.query(`
        SELECT
          t.salesman_code,
          t.product_code,
          t.product_name,
          SUM(t.total_amount) as product_sales,
          SUM(t.quantity) as product_quantity
        FROM new_flat_transactions t
        WHERE t.trx_date_only >= $1 AND t.trx_date_only <= $2
          AND t.salesman_code IS NOT NULL
          AND t.product_code IS NOT NULL
          AND t.total_amount > 0
        GROUP BY t.salesman_code, t.product_code, t.product_name
        ORDER BY t.salesman_code, product_sales DESC
      `, [startOfMonth, date])
    ])

    // Process and consolidate the data
    const salesmenData = salesmenResult.rows || []
    const salesmenMTDData = salesmenMTDResult.rows || []
    const routesData = routesResult.rows || []
    const transactionsSummary = transactionsResult.rows[0] || {}
    const visitsData = visitsResult.rows || []
    const visitsMTDData = visitsMTDResult.rows || []
    const paymentsData = paymentsResult.rows || []
    const paymentsMTDData = paymentsMTDResult.rows || []
    const skuDayData = skuDayResult.rows || []
    const skuMTDData = skuMTDResult.rows || []

    // Debug SKU data for salesman 21331
    const debug21331Day = skuDayData.filter(s => s.salesman_code === '21331')
    const debug21331MTD = skuMTDData.filter(s => s.salesman_code === '21331')
    console.log(`\n📦 RAW SKU DATA for Salesman 21331:`)
    console.log(`   DAY records: ${debug21331Day.length}`)
    console.log(`   MTD records: ${debug21331MTD.length}`)
    if (debug21331Day.length > 0) {
      console.log(`   DAY sample:`, debug21331Day.slice(0, 2))
    }
    if (debug21331MTD.length > 0) {
      console.log(`   MTD sample:`, debug21331MTD.slice(0, 2))
    }

    // Create lookup maps for efficient data merging
    const visitMap = new Map(visitsData.map(v => [v.salesman_code, v]))
    const visitMTDMap = new Map(visitsMTDData.map(v => [v.salesman_code, v]))
    const paymentMap = new Map(paymentsData.map(p => [p.salesman_code, p]))
    const paymentMTDMap = new Map(paymentsMTDData.map(p => [p.salesman_code, p]))
    const routeMap = new Map(routesData.map(r => [r.route_code, r]))
    const mtdDataMap = new Map(salesmenMTDData.map(s => [s.salesman_code, s]))

    // Process SKU data to calculate Top 10 and Last 5 contributions
    const calculateSKUContributions = (skuData: any[], salesmanCode: string, periodLabel: string) => {
      const salesmanProducts = skuData
        .filter(sku => sku.salesman_code === salesmanCode)
        .sort((a, b) => parseFloat(b.product_sales) - parseFloat(a.product_sales))

      // Debug specific salesman
      if (salesmanCode === '21331') {
        console.log(`\n🔍 SKU Analysis [${periodLabel}] - Salesman ${salesmanCode}:`)
        console.log(`   Total SKU records in data: ${skuData.filter(s => s.salesman_code === salesmanCode).length}`)
        console.log(`   Products found: ${salesmanProducts.length}`)
        if (salesmanProducts.length > 0) {
          const totalSales = salesmanProducts.reduce((sum, p) => sum + parseFloat(p.product_sales || 0), 0)
          console.log(`   Total sales: ${totalSales}`)
          console.log(`   Top 3 products:`, salesmanProducts.slice(0, 3).map(p => `${p.product_code}: ${p.product_sales}`))
          if (salesmanProducts.length >= 5) {
            console.log(`   Bottom 5 products:`, salesmanProducts.slice(-5).map(p => `${p.product_code}: ${p.product_sales}`))
          }
        }
      }

      if (salesmanProducts.length === 0) {
        return { top10Contribution: 0, last5Contribution: 0 }
      }

      // Calculate TOTAL sales from all products (this is the correct denominator)
      const totalSales = salesmanProducts.reduce((sum, p) => sum + parseFloat(p.product_sales || 0), 0)

      if (totalSales === 0) {
        return { top10Contribution: 0, last5Contribution: 0 }
      }

      // Top 10 SKU contribution
      const top10 = salesmanProducts.slice(0, Math.min(10, salesmanProducts.length))
      const top10Sales = top10.reduce((sum, p) => sum + parseFloat(p.product_sales || 0), 0)
      const top10Contribution = (top10Sales / totalSales) * 100

      // Last 5 SKU contribution - only if salesman has at least 5 products
      let last5Contribution = 0
      if (salesmanProducts.length >= 5) {
        const last5 = salesmanProducts.slice(-5)
        const last5Sales = last5.reduce((sum, p) => sum + parseFloat(p.product_sales || 0), 0)
        last5Contribution = (last5Sales / totalSales) * 100
      }

      return {
        top10Contribution: Math.round(top10Contribution * 10) / 10,
        last5Contribution: Math.round(last5Contribution * 10) / 10
      }
    }

    // Get salesman-specific planned customers (use historical average if journey plan is broken)
    const getSalesmanPlannedCustomers = (salesman: any, routeInfo: any) => {
      // If route has planned_customers, divide by number of salesmen on route
      if (routeInfo?.planned_customers && routeInfo?.assigned_salesmen) {
        return Math.ceil(parseInt(routeInfo.planned_customers) / parseInt(routeInfo.assigned_salesmen))
      }
      // Fallback to actual customers visited as the plan
      return parseInt(salesman.unique_customers || 0)
    }

    // Map route codes to regions (derive from route patterns)
    const getRegionFromRoute = (routeCode: string): string => {
      if (!routeCode) return 'Unknown'

      // Pattern-based region mapping based on route codes
      const code = routeCode.toUpperCase()

      // Dubai routes (D, DX, R0xx)
      if (code.startsWith('D') || code.startsWith('R0')) {
        return 'Dubai'
      }
      // Abu Dhabi routes (A, AX, A3xx)
      if (code.startsWith('A')) {
        return 'Abu Dhabi'
      }
      // Sharjah routes (S, SX)
      if (code.startsWith('S')) {
        return 'Sharjah'
      }
      // Al Ain routes (AL, AA)
      if (code.startsWith('AL') || code.startsWith('AA')) {
        return 'Al Ain'
      }
      // Fujairah routes (F, FX)
      if (code.startsWith('F')) {
        return 'Fujairah'
      }
      // Ras Al Khaimah routes (R3xx, RAK)
      if (code.startsWith('R3') || code.startsWith('RAK')) {
        return 'Ras Al Khaimah'
      }
      // Ajman routes (AJ)
      if (code.startsWith('AJ')) {
        return 'Ajman'
      }
      // Umm Al Quwain routes (UQ)
      if (code.startsWith('UQ')) {
        return 'Umm Al Quwain'
      }
      // Khor routes (K)
      if (code.startsWith('K')) {
        return 'Northern Emirates'
      }
      // Default for unmatched patterns
      return 'Central UAE'
    }

    // Consolidate all salesman data with KPIs
    const consolidatedSalesmen = salesmenData.map(salesman => {
      const visits = visitMap.get(salesman.salesman_code) || {}
      const visitsMTD = visitMTDMap.get(salesman.salesman_code) || {}
      const payments = paymentMap.get(salesman.salesman_code) || {}
      const paymentsMTD = paymentMTDMap.get(salesman.salesman_code) || {}
      const routeInfo = routeMap.get(salesman.route_code) || {}
      const mtdData = mtdDataMap.get(salesman.salesman_code) || {}

      const totalVisits = parseInt(visits.total_visits || 0)
      const productiveVisits = parseInt(visits.productive_visits || 0)
      const productivity = totalVisits > 0 ? (productiveVisits / totalVisits) * 100 : 0

      // Calculate SKU contributions for Day and MTD
      // Note: Function calculates totalSales from product data to ensure accuracy
      const daySkuContrib = calculateSKUContributions(skuDayData, salesman.salesman_code, 'DAY')
      const mtdSkuContrib = calculateSKUContributions(skuMTDData, salesman.salesman_code, 'MTD')

      return {
        // Basic Info
        code: salesman.salesman_code,
        name: salesman.salesman_name,
        routeCode: salesman.route_code,
        region: getRegionFromRoute(salesman.route_code),

        // Sales KPIs - DAILY
        sales: parseFloat(salesman.total_sales || 0),
        totalOrders: parseInt(salesman.total_orders || 0),
        avgOrderValue: parseFloat(salesman.avg_order_value || 0),
        uniqueCustomers: parseInt(salesman.unique_customers || 0),
        uniqueProducts: parseInt(salesman.unique_products || 0),

        // SKU Contribution KPIs - DAILY
        top10SKUContribution: daySkuContrib.top10Contribution,
        last5SKUContribution: daySkuContrib.last5Contribution,

        // Sales KPIs - MTD
        mtdSales: parseFloat(mtdData.mtd_total_sales || 0),
        mtdTotalOrders: parseInt(mtdData.mtd_total_orders || 0),
        mtdAvgOrderValue: parseFloat(mtdData.mtd_avg_order_value || 0),
        mtdUniqueCustomers: parseInt(mtdData.mtd_unique_customers || 0),
        mtdUniqueProducts: parseInt(mtdData.mtd_unique_products || 0),

        // SKU Contribution KPIs - MTD
        mtdTop10SKUContribution: mtdSkuContrib.top10Contribution,
        mtdLast5SKUContribution: mtdSkuContrib.last5Contribution,

        // Visit KPIs - DAILY
        visits: totalVisits,
        productiveVisits: productiveVisits,
        productivity: productivity,
        avgVisitDuration: parseFloat(visits.avg_visit_duration || 0),
        customersVisited: parseInt(visits.customers_visited || 0),

        // Visit KPIs - MTD
        mtdVisits: parseInt(visitsMTD.mtd_total_visits || 0),
        mtdProductiveVisits: parseInt(visitsMTD.mtd_productive_visits || 0),
        mtdAvgVisitDuration: parseFloat(visitsMTD.mtd_avg_visit_duration || 0),
        mtdCustomersVisited: parseInt(visitsMTD.mtd_customers_visited || 0),

        // Collection KPIs - DAILY
        collections: parseInt(payments.total_collections || 0),
        totalCollected: parseFloat(payments.total_collected || 0),
        avgCollectionAmount: parseFloat(payments.avg_collection_amount || 0),

        // Collection KPIs - MTD
        mtdCollections: parseInt(paymentsMTD.mtd_total_collections || 0),
        mtdTotalCollected: parseFloat(paymentsMTD.mtd_total_collected || 0),
        mtdAvgCollectionAmount: parseFloat(paymentsMTD.mtd_avg_collection_amount || 0),

        // Route Info with proper planned customers
        routeTotalCustomers: parseInt(routeInfo.total_customers || 0),
        routePlannedCustomers: getSalesmanPlannedCustomers(salesman, routeInfo),
        routeTotalSales: parseFloat(routeInfo.route_sales || 0),

        // Calculated KPIs
        salesPerCustomer: parseInt(salesman.unique_customers || 0) > 0 ?
          parseFloat(salesman.total_sales || 0) / parseInt(salesman.unique_customers || 0) : 0,

        // Time KPIs - Day values
        firstTransaction: salesman.first_transaction,
        lastTransaction: salesman.last_transaction,

        // Time KPIs - MTD values
        mtdFirstTransaction: mtdData?.mtd_first_transaction || salesman.first_transaction,
        mtdLastTransaction: mtdData?.mtd_last_transaction || salesman.last_transaction,

        // Performance Status
        performanceStatus: productivity >= 90 ? 'Excellent' :
          productivity >= 75 ? 'Good' :
          productivity >= 60 ? 'Average' : 'Poor',

        // Target availability indicator
        hasTargets: SALESMEN_WITH_TARGETS.includes(salesman.salesman_code)
      }
    })

    // Sort by sales performance
    consolidatedSalesmen.sort((a, b) => b.sales - a.sales)

    console.log(`✅ ExcelSheet API: Processed ${consolidatedSalesmen.length} salesmen with complete KPI data`)
    console.log(`🎯 Salesmen with targets: ${consolidatedSalesmen.filter(s => s.hasTargets).length} out of ${consolidatedSalesmen.length}`)

    return {
      success: true,
      date: date,
      data: {
        salesmen: consolidatedSalesmen,
        routes: routesData,
        summary: {
          ...transactionsSummary,
          totalSalesmenActive: consolidatedSalesmen.length,
          totalRoutesActive: routesData.length,
          avgSalesPerSalesman: consolidatedSalesmen.length > 0 ?
            consolidatedSalesmen.reduce((sum, s) => sum + s.sales, 0) / consolidatedSalesmen.length : 0,
          avgProductivityRate: consolidatedSalesmen.length > 0 ?
            consolidatedSalesmen.reduce((sum, s) => sum + s.productivity, 0) / consolidatedSalesmen.length : 0
        }
      },
      timestamp: new Date().toISOString(),
      cached: true
    }
  },
  ['excel-sheet-data'], // Cache key prefix
  {
    revalidate: 300, // 5 minutes cache
    tags: ['excel-sheet-data']
  }
)

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0]

    // Use cached data fetcher
    const result = await getCachedExcelSheetData(date)

    return NextResponse.json(result)

  } catch (error) {
    console.error('❌ ExcelSheet API Error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch Excel sheet data',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}