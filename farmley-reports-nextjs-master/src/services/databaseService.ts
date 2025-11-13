import { db, buildWhereClause, buildOrderClause, buildLimitClause } from '../lib/database'
import { cache } from '../lib/cache'
import { CACHE_TTL } from '../config/database'
import type {
  Transaction,
  Customer,
  Product,
  Journey,
  Visit,
  Target,
  DashboardKPI,
  SalesTrendData,
  FilterOptions
} from '../types'
import { IDataService } from './dataService'

export class PostgresDataService implements IDataService {

  // Dashboard KPIs - using flat_dashboard_kpi table (optimized)
  public async getDashboardKPIs(): Promise<DashboardKPI> {
    return cache.getOrSet(
      'dashboard:kpi',
      async () => {
        // Get dashboard KPIs from optimized flat table using actual column names
        const kpiQuery = `
          SELECT
            calculation_date,
            today_sales,
            today_orders,
            today_customers,
            growth_percentage,
            mtd_sales,
            ytd_sales,
            average_order_value,
            conversion_rate,
            last_updated
          FROM flat_dashboard_kpi
          WHERE calculation_date = CURRENT_DATE
          ORDER BY last_updated DESC
          LIMIT 1
        `

        const result = await db.query(kpiQuery)
        const kpi = result.rows[0] || {}

        return {
          todaySales: parseFloat(kpi.today_sales || 0),
          todayOrders: parseInt(kpi.today_orders || 0),
          todayCustomers: parseInt(kpi.today_customers || 0),
          growthPercentage: parseFloat(kpi.growth_percentage || 0),
          mtdSales: parseFloat(kpi.mtd_sales || 0),
          ytdSales: parseFloat(kpi.ytd_sales || 0),
          averageOrderValue: parseFloat(kpi.average_order_value || 0),
          conversionRate: parseFloat(kpi.conversion_rate || 75)
        }
      },
      CACHE_TTL.DASHBOARD_KPI
    )
  }

  // Sales trend data using optimized flat table with actual column names
  public async getSalesTrend(days: number): Promise<SalesTrendData[]> {
    return cache.getOrSet(
      `sales:trend:${days}`,
      async () => {
        const query = `
          SELECT
            trend_date,
            date_string,
            sales,
            orders,
            customers,
            salesmen,
            moving_avg_7d,
            moving_avg_30d,
            prev_day_sales,
            prev_week_sales
          FROM flat_sales_trend_optimized
          WHERE trend_date >= CURRENT_DATE - INTERVAL '${days} days'
          ORDER BY trend_date ASC
        `

        const result = await db.query(query)
        return result.rows.map(row => ({
          date: row.trend_date.toISOString().split('T')[0],
          sales: parseFloat(row.sales || 0),
          orders: parseInt(row.orders || 0),
          customers: parseInt(row.customers || 0),
          salesmen: parseInt(row.salesmen || 0),
          movingAvg7d: parseFloat(row.moving_avg_7d || 0),
          movingAvg30d: parseFloat(row.moving_avg_30d || 0),
          prevDaySales: parseFloat(row.prev_day_sales || 0),
          prevWeekSales: parseFloat(row.prev_week_sales || 0)
        }))
      },
      CACHE_TTL.SALES_TREND
    )
  }

  // Transactions with efficient filtering using new_flat_transactions table
  public async getTransactions(filters?: FilterOptions): Promise<Transaction[]> {
    const cacheKey = `transactions:${JSON.stringify(filters || {})}`

    return cache.getOrSet(
      cacheKey,
      async () => {
        // Get transaction headers with totals grouped by trx_code
        let baseQuery = `
          SELECT
            trx_code,
            '' as app_trx_id,
            '' as org_code,
            '' as journey_code,
            '' as visit_code,
            MIN(salesman_code) as user_code,
            MIN(salesman_name) as user_name,
            MIN(customer_code) as client_code,
            MIN(customer_name) as client_name,
            MIN(trx_date_only) as trx_date,
            'SALE' as trx_type,
            'CASH' as payment_type,
            SUM(total_amount) as total_amount,
            0 as total_discount_amount,
            0 as total_tax_amount,
            'COMPLETED' as status,
            false as is_van_sales,
            '' as route_code,
            '' as route_name,
            0 as geo_x,
            0 as geo_y
          FROM new_flat_transactions
        `

        const whereConditions: string[] = []
        const params: any[] = []
        let paramIndex = 1

        if (filters) {
          if (filters.startDate) {
            whereConditions.push(`trx_date_only >= $${paramIndex++}`)
            params.push(filters.startDate)
          }
          if (filters.endDate) {
            whereConditions.push(`trx_date_only <= $${paramIndex++}`)
            params.push(filters.endDate)
          }
          // Skip organizationCode filter as org_code column doesn't exist
          // Skip routeCode filter as route_code column doesn't exist
          if (filters.userCode) {
            whereConditions.push(`salesman_code = $${paramIndex++}`)
            params.push(filters.userCode)
          }
        }

        if (whereConditions.length > 0) {
          baseQuery += ` WHERE ${whereConditions.join(' AND ')}`
        }

        // Add GROUP BY for transaction headers
        baseQuery += ' GROUP BY trx_code'
        // Only show transactions with actual amounts
        baseQuery += ' HAVING SUM(total_amount) > 0'
        baseQuery += ' ORDER BY MIN(trx_date_only) DESC, SUM(total_amount) DESC LIMIT 10' // Order by most recent date first

        const result = await db.query(baseQuery, params)
        return result.rows.map(row => ({
          trxCode: row.trx_code,
          appTrxId: row.app_trx_id,
          orgCode: row.org_code,
          journeyCode: row.journey_code,
          visitCode: row.visit_code,
          userCode: row.user_code,
          userName: row.user_name,
          clientCode: row.client_code,
          clientName: row.client_name,
          trxDate: new Date(row.trx_date),
          trxType: row.trx_type,
          paymentType: row.payment_type,
          totalAmount: parseFloat(row.total_amount || 0),
          totalDiscountAmount: parseFloat(row.total_discount_amount || 0),
          totalTaxAmount: parseFloat(row.total_tax_amount || 0),
          status: row.status,
          isVanSales: row.is_van_sales,
          routeCode: row.route_code,
          routeName: row.route_name,
          geoX: parseFloat(row.geo_x || 0),
          geoY: parseFloat(row.geo_y || 0)
        }))
      },
      CACHE_TTL.TRANSACTIONS
    )
  }

  public async getTransaction(trxCode: string): Promise<Transaction | null> {
    // Get transaction header with totals
    const query = `
      SELECT
        trx_code,
        '' as app_trx_id,
        '' as org_code,
        '' as journey_code,
        '' as visit_code,
        MIN(salesman_code) as user_code,
        MIN(salesman_name) as user_name,
        MIN(customer_code) as client_code,
        MIN(customer_name) as client_name,
        MIN(trx_date_only) as trx_date,
        'SALE' as trx_type,
        'CASH' as payment_type,
        SUM(total_amount) as total_amount,
        0 as total_discount_amount,
        0 as total_tax_amount,
        'COMPLETED' as status,
        false as is_van_sales,
        '' as route_code,
        '' as route_name,
        0 as geo_x,
        0 as geo_y
      FROM new_flat_transactions
      WHERE trx_code = $1
      GROUP BY trx_code
    `

    const result = await db.query(query, [trxCode])

    if (result.rows.length === 0) {
      return null
    }

    const row = result.rows[0]
    return {
      trxCode: row.trx_code,
      appTrxId: row.app_trx_id,
      orgCode: row.org_code,
      journeyCode: row.journey_code,
      visitCode: row.visit_code,
      userCode: row.user_code,
      userName: row.user_name,
      clientCode: row.client_code,
      clientName: row.client_name,
      trxDate: new Date(row.trx_date),
      trxType: row.trx_type,
      paymentType: row.payment_type,
      totalAmount: parseFloat(row.total_amount || 0),
      totalDiscountAmount: parseFloat(row.total_discount_amount || 0),
      totalTaxAmount: parseFloat(row.total_tax_amount || 0),
      status: row.status,
      isVanSales: row.is_van_sales,
      routeCode: row.route_code,
      routeName: row.route_name,
      geoX: parseFloat(row.geo_x || 0),
      geoY: parseFloat(row.geo_y || 0)
    }
  }

  // Top customers based on recent visit performance and activity
  public async getTopCustomers(limit: number = 10): Promise<Customer[]> {
    return cache.getOrSet(
      `customers:top:${limit}`,
      async () => {
        // Get top customers from flat_customer_analytics table
        const query = `
          SELECT
            customer_code,
            customer_name,
            customer_arabic_name,
            customer_type,
            route_code,
            route_name,
            channel_code,
            classification_code,
            credit_limit,
            outstanding_amount,
            last_order_date,
            total_orders,
            total_sales,
            average_order_value,
            status,
            gps_latitude,
            gps_longitude,
            orders_last_30d,
            sales_last_30d,
            active_days,
            total_visits,
            last_visit_date,
            unique_visit_days,
            days_since_visit,
            avg_visit_duration_minutes,
            sales_rank,
            order_rank,
            visit_rank
          FROM flat_customer_analytics
          WHERE total_sales > 0
          ORDER BY total_sales DESC, total_orders DESC
          LIMIT $1
        `

        const result = await db.query(query, [limit])
        return result.rows.map(row => ({
          customerCode: row.customer_code,
          customerName: row.customer_name || 'Unknown Customer',
          customerArabicName: row.customer_arabic_name || '',
          customerType: row.customer_type || 'Regular',
          routeCode: row.route_code || '',
          routeName: row.route_name || '',
          channelCode: row.channel_code || '',
          classificationCode: row.classification_code || '',
          creditLimit: parseInt(row.credit_limit || 0),
          outstandingAmount: parseInt(row.outstanding_amount || 0),
          lastOrderDate: row.last_order_date ? new Date(row.last_order_date) : undefined,
          totalOrders: parseInt(row.total_orders || 0),
          totalSales: parseFloat(row.total_sales || 0),
          averageOrderValue: parseFloat(row.average_order_value || 0),
          status: row.status || 'Unknown',
          gpsLatitude: parseFloat(row.gps_latitude || 0),
          gpsLongitude: parseFloat(row.gps_longitude || 0)
        }))
      },
      CACHE_TTL.TOP_CUSTOMERS
    )
  }

  public async getCustomers(filters?: FilterOptions): Promise<Customer[]> {
    // Use flat_customer_analytics table
    const whereConditions: string[] = []
    const params: any[] = []
    let paramIndex = 1

    if (filters) {
      if (filters.routeCode) {
        whereConditions.push(`route_code = $${paramIndex++}`)
        params.push(filters.routeCode)
      }
      if (filters.customerType) {
        whereConditions.push(`customer_type = $${paramIndex++}`)
        params.push(filters.customerType)
      }
    }

    const query = `
      SELECT
        customer_code,
        customer_name,
        customer_arabic_name,
        customer_type,
        route_code,
        route_name,
        channel_code,
        classification_code,
        credit_limit,
        outstanding_amount,
        last_order_date,
        total_orders,
        total_sales,
        average_order_value,
        status,
        gps_latitude,
        gps_longitude,
        orders_last_30d,
        sales_last_30d,
        active_days,
        total_visits,
        last_visit_date,
        unique_visit_days,
        days_since_visit,
        avg_visit_duration_minutes,
        sales_rank,
        order_rank,
        visit_rank
      FROM flat_customer_analytics
      ${whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : ''}
      ORDER BY customer_name
      LIMIT 1000
    `

    const result = await db.query(query, params)
    return result.rows.map(row => ({
      customerCode: row.customer_code,
      customerName: row.customer_name || 'Unknown Customer',
      customerArabicName: row.customer_arabic_name || '',
      customerType: row.customer_type || 'Regular',
      routeCode: row.route_code || '',
      routeName: row.route_name || '',
      channelCode: row.channel_code || '',
      classificationCode: row.classification_code || '',
      creditLimit: parseInt(row.credit_limit || 0),
      outstandingAmount: parseInt(row.outstanding_amount || 0),
      lastOrderDate: row.last_order_date ? new Date(row.last_order_date) : undefined,
      totalOrders: parseInt(row.total_orders || 0),
      totalSales: parseFloat(row.total_sales || 0),
      averageOrderValue: parseFloat(row.average_order_value || 0),
      status: row.status || 'Unknown',
      gpsLatitude: parseFloat(row.gps_latitude || 0),
      gpsLongitude: parseFloat(row.gps_longitude || 0)
    }))
  }

  public async getCustomer(customerCode: string): Promise<Customer | null> {
    // Use flat_customer_analytics table
    const result = await db.query(`
      SELECT
        customer_code,
        customer_name,
        customer_arabic_name,
        customer_type,
        route_code,
        route_name,
        channel_code,
        classification_code,
        credit_limit,
        outstanding_amount,
        last_order_date,
        total_orders,
        total_sales,
        average_order_value,
        status,
        gps_latitude,
        gps_longitude,
        orders_last_30d,
        sales_last_30d,
        active_days,
        total_visits,
        last_visit_date,
        unique_visit_days,
        days_since_visit,
        avg_visit_duration_minutes,
        sales_rank,
        order_rank,
        visit_rank
      FROM flat_customer_analytics
      WHERE customer_code = $1
    `, [customerCode])

    if (result.rows.length === 0) return null

    const row = result.rows[0]
    return {
      customerCode: row.customer_code,
      customerName: row.customer_name || 'Unknown Customer',
      customerArabicName: row.customer_arabic_name || '',
      customerType: row.customer_type || 'Regular',
      routeCode: row.route_code || '',
      routeName: row.route_name || '',
      channelCode: row.channel_code || '',
      classificationCode: row.classification_code || '',
      creditLimit: parseInt(row.credit_limit || 0),
      outstandingAmount: parseInt(row.outstanding_amount || 0),
      lastOrderDate: row.last_order_date ? new Date(row.last_order_date) : undefined,
      totalOrders: parseInt(row.total_orders || 0),
      totalSales: parseFloat(row.total_sales || 0),
      averageOrderValue: parseFloat(row.average_order_value || 0),
      status: row.status || 'Unknown',
      gpsLatitude: parseFloat(row.gps_latitude || 0),
      gpsLongitude: parseFloat(row.gps_longitude || 0)
    }
  }

  // Top products with optimized queries based on actual schema
  public async getTopProducts(limit: number = 10): Promise<Product[]> {
    return cache.getOrSet(
      `products:top:${limit}`,
      async () => {
        const query = `
          SELECT
            item_code,
            item_description,
            item_arabic_description,
            category,
            sub_category,
            brand,
            brand_code,
            base_uom,
            sales_uom,
            conversion_factor,
            price,
            tax_percentage,
            is_active,
            total_quantity_sold,
            total_revenue,
            average_price,
            transactions_30d,
            quantity_sold_30d,
            revenue_30d,
            quantity_rank,
            revenue_rank,
            performance_category
          FROM flat_product_analytics
          WHERE is_active = true
          AND total_revenue > 0
          ORDER BY
            total_revenue DESC,
            total_quantity_sold DESC,
            revenue_rank ASC
          LIMIT $1
        `

        const result = await db.query(query, [limit])
        return result.rows.map(row => ({
          itemCode: row.item_code,
          itemDescription: row.item_description || '',
          itemArabicDescription: row.item_arabic_description || '',
          category: row.category || '',
          subCategory: row.sub_category || '',
          brand: row.brand || '',
          brandCode: row.brand_code || '',
          baseUOM: row.base_uom || 'PCS',
          salesUOM: row.sales_uom || 'PCS',
          conversionFactor: parseInt(row.conversion_factor || 1),
          price: parseInt(row.price || 0),
          taxPercentage: parseInt(row.tax_percentage || 0),
          isActive: row.is_active || false,
          totalQuantitySold: parseFloat(row.total_quantity_sold || 0),
          totalRevenue: parseFloat(row.total_revenue || 0),
          averagePrice: parseFloat(row.average_price || 0),
          transactions30d: parseInt(row.transactions_30d || 0),
          quantitySold30d: parseFloat(row.quantity_sold_30d || 0),
          revenue30d: parseFloat(row.revenue_30d || 0),
          quantityRank: parseInt(row.quantity_rank || 0),
          revenueRank: parseInt(row.revenue_rank || 0),
          performanceCategory: row.performance_category || 'Unknown'
        }))
      },
      CACHE_TTL.TOP_PRODUCTS
    )
  }

  // Get all products with filtering
  public async getProducts(filters?: FilterOptions): Promise<Product[]> {
    return cache.getOrSet(
      `products:${JSON.stringify(filters || {})}`,
      async () => {
        let whereConditions = ['i.isactive = true']
        const params: any[] = []
        let paramIndex = 1

        if (filters?.productCategory) {
          whereConditions.push(`i.grouplevel1 = $${paramIndex++}`)
          params.push(filters.productCategory)
        }

        const query = `
          SELECT
            i.code as itemcode,
            i.description as itemdescription,
            i.altdescription as itemaltdescription,
            i.grouplevel1 as itemgroupcode,
            i.grouplevel2 as brandcode,
            i.isactive,
            i.baseuom as base_uom,
            1 as conversion,
            COALESCE(sales_data.total_quantity, 0) as total_quantity_sold,
            COALESCE(sales_data.total_revenue, 0) as total_revenue,
            COALESCE(sales_data.avg_price, 0) as average_price,
            COALESCE(sales_data.total_orders, 0) as total_orders
          FROM tblitem i
          LEFT JOIN (
            SELECT
              itemcode,
              SUM(quantitylevel1) as total_quantity,
              SUM(pricelevel1 * quantitylevel1) as total_revenue,
              AVG(pricelevel1) as avg_price,
              COUNT(DISTINCT movementcode) as total_orders
            FROM tblmovementdetail
            WHERE status = 1
            AND itemcode IS NOT NULL
            GROUP BY itemcode
          ) sales_data ON i.code = sales_data.itemcode
          WHERE ${whereConditions.join(' AND ')}
          ORDER BY i.itemdescription
          LIMIT 1000
        `

        const result = await db.query(query, params)
        return result.rows.map(row => ({
          itemCode: row.itemcode,
          itemDescription: row.itemdescription || '',
          itemArabicDescription: row.itemaltdescription || '',
          category: row.itemgroupcode || '',
          subCategory: '',
          brand: '',
          brandCode: row.brandcode || '',
          baseUOM: row.base_uom || 'PCS',
          salesUOM: row.base_uom || 'PCS',
          conversionFactor: parseFloat(row.conversion || 1),
          price: parseFloat(row.average_price || 0),
          taxPercentage: 0,
          isActive: row.isactive || false,
          totalQuantitySold: parseFloat(row.total_quantity_sold || 0),
          totalRevenue: parseFloat(row.total_revenue || 0),
          averagePrice: parseFloat(row.average_price || 0)
        }))
      },
      CACHE_TTL.PRODUCTS
    )
  }

  public async getProduct(itemCode: string): Promise<Product | null> {
    const query = `
      SELECT
        i.code as itemcode,
        i.description as itemdescription,
        i.altdescription as itemaltdescription,
        i.grouplevel1 as itemgroupcode,
        i.grouplevel2 as brandcode,
        i.isactive,
        i.baseuom as base_uom,
        1 as conversion,
        COALESCE(sales_data.total_quantity, 0) as total_quantity_sold,
        COALESCE(sales_data.total_revenue, 0) as total_revenue,
        COALESCE(sales_data.avg_price, 0) as average_price,
        COALESCE(sales_data.total_orders, 0) as total_orders
      FROM tblitem i
      LEFT JOIN (
        SELECT
          itemcode,
          SUM(COALESCE(quantitylevel1, 0)) as total_quantity,
          SUM(COALESCE(pricelevel1, 0) * COALESCE(quantitylevel1, 0)) as total_revenue,
          AVG(NULLIF(pricelevel1, 0)) as avg_price,
          COUNT(DISTINCT movementcode) as total_orders
        FROM tblmovementdetail
        WHERE status IN (2, 3)
        AND itemcode = $1
        GROUP BY itemcode
      ) sales_data ON i.code = sales_data.itemcode
      WHERE i.code = $1
    `

    const result = await db.query(query, [itemCode])
    if (result.rows.length === 0) return null

    const row = result.rows[0]
    return {
      itemCode: row.itemcode,
      itemDescription: row.itemdescription || '',
      itemArabicDescription: row.itemaltdescription || '',
      category: row.itemgroupcode || '',
      subCategory: '',
      brand: '',
      brandCode: row.brandcode || '',
      baseUOM: row.base_uom || 'PCS',
      salesUOM: row.base_uom || 'PCS',
      conversionFactor: parseFloat(row.conversion || 1),
      price: parseFloat(row.average_price || 0),
      taxPercentage: 0,
      isActive: row.isactive || false,
      totalQuantitySold: parseFloat(row.total_quantity_sold || 0),
      totalRevenue: parseFloat(row.total_revenue || 0),
      averagePrice: parseFloat(row.average_price || 0)
    }
  }

  public async getJourneys(filters?: FilterOptions): Promise<Journey[]> {
    const whereConditions: string[] = []
    const params: any[] = []
    let paramIndex = 1

    if (filters) {
      if (filters.startDate) {
        whereConditions.push(`j.journeydate >= $${paramIndex++}`)
        params.push(filters.startDate)
      }
      if (filters.endDate) {
        whereConditions.push(`j.journeydate <= $${paramIndex++}`)
        params.push(filters.endDate)
      }
      if (filters.routeCode) {
        whereConditions.push(`j.routecode = $${paramIndex++}`)
        params.push(filters.routeCode)
      }
      if (filters.userCode) {
        whereConditions.push(`j.empno = $${paramIndex++}`)
        params.push(filters.userCode)
      }
    }

    const query = `
      SELECT
        j.journeycode,
        j.empno as user_code,
        u.username as user_name,
        j.journeydate,
        j.routecode as route_code,
        r.routename as route_name,
        j.startedat,
        j.endedat,
        j.journeyplan,
        COUNT(DISTINCT djp.customercode) as planned_visits,
        COUNT(DISTINCT CASE WHEN cv.visitstatus = 1 THEN cv.customercode END) as completed_visits
      FROM tbljourney j
      LEFT JOIN tbluser u ON j.empno = u.empcode
      LEFT JOIN tblroute r ON j.routecode = r.routecode
      LEFT JOIN tbldailyjourneyplan djp ON j.journeycode = djp.journeycode
      LEFT JOIN tblcustomervisit cv ON djp.visitcode = cv.visitcode
      ${whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : ''}
      GROUP BY j.journeycode, j.empno, u.username, j.journeydate, j.routecode, r.routename, j.startedat, j.endedat, j.journeyplan
      ORDER BY j.journeydate DESC
      LIMIT 500
    `

    const result = await db.query(query, params)
    return result.rows.map(row => ({
      journeyCode: row.journeycode,
      userCode: row.user_code,
      userName: row.user_name || '',
      journeyDate: new Date(row.journeydate),
      routeCode: row.route_code,
      routeName: row.route_name || '',
      startTime: row.startedat ? new Date(row.startedat) : undefined,
      endTime: row.endedat ? new Date(row.endedat) : undefined,
      status: row.journeyplan || 0,
      plannedVisits: parseInt(row.planned_visits || 0),
      completedVisits: parseInt(row.completed_visits || 0),
      totalSales: 0,
      totalOrders: 0
    }))
  }

  public async getJourney(journeyCode: string): Promise<Journey | null> {
    const query = `
      SELECT
        j.journeycode,
        j.empno as user_code,
        u.username as user_name,
        j.journeydate,
        j.routecode as route_code,
        r.routename as route_name,
        j.startedat,
        j.endedat,
        j.journeyplan,
        COUNT(DISTINCT djp.customercode) as planned_visits,
        COUNT(DISTINCT CASE WHEN cv.visitstatus = 1 THEN cv.customercode END) as completed_visits
      FROM tbljourney j
      LEFT JOIN tbluser u ON j.empno = u.empcode
      LEFT JOIN tblroute r ON j.routecode = r.routecode
      LEFT JOIN tbldailyjourneyplan djp ON j.journeycode = djp.journeycode
      LEFT JOIN tblcustomervisit cv ON djp.visitcode = cv.visitcode
      WHERE j.journeycode = $1
      GROUP BY j.journeycode, j.empno, u.username, j.journeydate, j.routecode, r.routename, j.startedat, j.endedat, j.journeyplan
    `

    const result = await db.query(query, [journeyCode])
    if (result.rows.length === 0) return null

    const row = result.rows[0]
    return {
      journeyCode: row.journeycode,
      userCode: row.user_code,
      userName: row.user_name || '',
      journeyDate: new Date(row.journeydate),
      routeCode: row.route_code,
      routeName: row.route_name || '',
      startTime: row.startedat ? new Date(row.startedat) : undefined,
      endTime: row.endedat ? new Date(row.endedat) : undefined,
      status: row.journeyplan || 0,
      plannedVisits: parseInt(row.planned_visits || 0),
      completedVisits: parseInt(row.completed_visits || 0),
      totalSales: 0,
      totalOrders: 0
    }
  }

  public async getVisits(journeyCode?: string): Promise<Visit[]> {
    let query = `
      SELECT
        cv.visitcode as visit_id,
        cv.journeycode as journey_code,
        cv.customercode as customer_code,
        c.customername as customer_name,
        cv.visitstartdate as start_time,
        cv.visitenddate as end_time,
        cv.visitstatus as status,
        cv.gpslatitude,
        cv.gpslongitude,
        cv.visitduration as duration_minutes,
        cv.visitnotes as notes
      FROM tblcustomervisit cv
      LEFT JOIN tblcustomer c ON cv.customercode = c.customercode
    `

    const params: any[] = []
    if (journeyCode) {
      query += ' WHERE cv.journeycode = $1'
      params.push(journeyCode)
    }
    query += ' ORDER BY cv.visitstartdate DESC LIMIT 500'

    const result = await db.query(query, params)
    return result.rows.map(row => ({
      visitId: row.visit_id,
      journeyCode: row.journey_code,
      customerCode: row.customer_code,
      customerName: row.customer_name || '',
      startTime: row.start_time ? new Date(row.start_time) : undefined,
      endTime: row.end_time ? new Date(row.end_time) : undefined,
      status: row.status || 0,
      durationMinutes: parseInt(row.duration_minutes || 0),
      gpsLatitude: parseFloat(row.gpslatitude || 0),
      gpsLongitude: parseFloat(row.gpslongitude || 0),
      notes: row.notes || '',
      totalSales: 0,
      totalOrders: 0
    }))
  }

  public async getVisit(visitId: string): Promise<Visit | null> {
    const query = `
      SELECT
        cv.visitcode as visit_id,
        cv.journeycode as journey_code,
        cv.customercode as customer_code,
        c.customername as customer_name,
        cv.visitstartdate as start_time,
        cv.visitenddate as end_time,
        cv.visitstatus as status,
        cv.gpslatitude,
        cv.gpslongitude,
        cv.visitduration as duration_minutes,
        cv.visitnotes as notes
      FROM tblcustomervisit cv
      LEFT JOIN tblcustomer c ON cv.customercode = c.customercode
      WHERE cv.visitcode = $1
    `

    const result = await db.query(query, [visitId])
    if (result.rows.length === 0) return null

    const row = result.rows[0]
    return {
      visitId: row.visit_id,
      journeyCode: row.journey_code,
      customerCode: row.customer_code,
      customerName: row.customer_name || '',
      startTime: row.start_time ? new Date(row.start_time) : undefined,
      endTime: row.end_time ? new Date(row.end_time) : undefined,
      status: row.status || 0,
      durationMinutes: parseInt(row.duration_minutes || 0),
      gpsLatitude: parseFloat(row.gpslatitude || 0),
      gpsLongitude: parseFloat(row.gpslongitude || 0),
      notes: row.notes || '',
      totalSales: 0,
      totalOrders: 0
    }
  }

  public async getTargets(filters?: FilterOptions): Promise<Target[]> {
    const whereConditions: string[] = []
    const params: any[] = []
    let paramIndex = 1

    if (filters?.userCode) {
      whereConditions.push(`t.empno = $${paramIndex++}`)
      params.push(filters.userCode)
    }

    const query = `
      SELECT
        t.targetcode,
        t.empno as user_code,
        u.username as user_name,
        t.targettype,
        t.targetvalue,
        t.achievedvalue,
        t.targetperiod,
        t.startdate,
        t.enddate,
        t.status,
        CASE
          WHEN t.targetvalue > 0 THEN (t.achievedvalue::float / t.targetvalue * 100)
          ELSE 0
        END as achievement_percentage
      FROM tblcommontarget t
      LEFT JOIN tbluser u ON t.empno = u.empcode
      ${whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : ''}
      ORDER BY t.startdate DESC
      LIMIT 500
    `

    const result = await db.query(query, params)
    return result.rows.map(row => ({
      targetCode: row.targetcode,
      userCode: row.user_code,
      userName: row.user_name || '',
      targetType: row.targettype || '',
      targetPeriod: row.targetperiod || '',
      startDate: row.startdate ? new Date(row.startdate) : new Date(),
      endDate: row.enddate ? new Date(row.enddate) : new Date(),
      targetValue: parseFloat(row.targetvalue || 0),
      achievedValue: parseFloat(row.achievedvalue || 0),
      achievementPercentage: parseFloat(row.achievement_percentage || 0),
      status: row.status || 0
    }))
  }

  public async getTarget(targetCode: string): Promise<Target | null> {
    const query = `
      SELECT
        t.targetcode,
        t.empno as user_code,
        u.username as user_name,
        t.targettype,
        t.targetvalue,
        t.achievedvalue,
        t.targetperiod,
        t.startdate,
        t.enddate,
        t.status,
        CASE
          WHEN t.targetvalue > 0 THEN (t.achievedvalue::float / t.targetvalue * 100)
          ELSE 0
        END as achievement_percentage
      FROM tblcommontarget t
      LEFT JOIN tbluser u ON t.empno = u.empcode
      WHERE t.targetcode = $1
    `

    const result = await db.query(query, [targetCode])
    if (result.rows.length === 0) return null

    const row = result.rows[0]
    return {
      targetCode: row.targetcode,
      userCode: row.user_code,
      userName: row.user_name || '',
      targetType: row.targettype || '',
      targetPeriod: row.targetperiod || '',
      startDate: row.startdate ? new Date(row.startdate) : new Date(),
      endDate: row.enddate ? new Date(row.enddate) : new Date(),
      targetValue: parseFloat(row.targetvalue || 0),
      achievedValue: parseFloat(row.achievedvalue || 0),
      achievementPercentage: parseFloat(row.achievement_percentage || 0),
      status: row.status || 0
    }
  }
}

// Export the service instance
export const postgresDataService = new PostgresDataService()