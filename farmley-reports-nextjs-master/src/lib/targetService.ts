import { db } from '@/lib/database'

export interface TargetData {
  salesmanCode: string
  amount: number
  timeframe: string
  year: number
  month?: number
  quarter?: number
  week?: number
  day?: number
  startDate: Date
  endDate: Date
}

export class TargetService {
  /**
   * Get target for a specific salesman and time period
   */
  static async getTargetForPeriod(
    salesmanCode: string,
    dateRange: string,
    currentDate: Date = new Date()
  ): Promise<number> {
    await db.initialize()

    const year = currentDate.getFullYear()
    const month = currentDate.getMonth() + 1
    const quarter = Math.ceil(month / 3)

    let timeframeFilter = ''
    let dateFilter = ''

    // Map date ranges to timeframe and build appropriate filters
    switch(dateRange) {
      case 'today':
      case 'yesterday':
        // For daily, get monthly target and divide by working days (26)
        timeframeFilter = `t.timeframe = 'M'`
        dateFilter = `t.year = ${year} AND t.month = ${month}`
        break

      case 'thisWeek':
      case 'lastWeek':
        // Look for weekly targets first, fallback to monthly
        timeframeFilter = `(t.timeframe = 'W' OR t.timeframe = 'M')`
        dateFilter = `t.year = ${year} AND t.month = ${month}`
        break

      case 'thisMonth':
        timeframeFilter = `t.timeframe = 'M'`
        dateFilter = `t.year = ${year} AND t.month = ${month}`
        break

      case 'lastMonth':
        const lastMonth = month === 1 ? 12 : month - 1
        const lastMonthYear = month === 1 ? year - 1 : year
        timeframeFilter = `t.timeframe = 'M'`
        dateFilter = `t.year = ${lastMonthYear} AND t.month = ${lastMonth}`
        break

      case 'lastQuarter':
        const lastQuarter = quarter === 1 ? 4 : quarter - 1
        const lastQuarterYear = quarter === 1 ? year - 1 : year

        // Calculate the months for last quarter
        let startMonth, endMonth
        if (lastQuarter === 1) {
          startMonth = 1; endMonth = 3
        } else if (lastQuarter === 2) {
          startMonth = 4; endMonth = 6
        } else if (lastQuarter === 3) {
          startMonth = 7; endMonth = 9
        } else {
          startMonth = 10; endMonth = 12
        }

        timeframeFilter = `(t.timeframe = 'Q' OR t.timeframe = 'M')`
        dateFilter = `t.year = ${lastQuarterYear} AND (t.quarter = ${lastQuarter} OR t.month IN (${startMonth}, ${startMonth + 1}, ${endMonth}))`
        break

      case 'thisYear':
        timeframeFilter = `(t.timeframe = 'Y' OR t.timeframe = 'M')`
        dateFilter = `t.year = ${year}`
        break

      default:
        // Default to current month
        timeframeFilter = `t.timeframe = 'M'`
        dateFilter = `t.year = ${year} AND t.month = ${month}`
    }

    const query = `
      SELECT t.amount, t.timeframe, t.year, t.month, t.quarter
      FROM tblcommontarget t
      WHERE t.salesmancode = $1
        AND t.isactive = true
        AND ${timeframeFilter}
        AND ${dateFilter}
      ORDER BY
        CASE t.timeframe
          WHEN 'D' THEN 1
          WHEN 'W' THEN 2
          WHEN 'M' THEN 3
          WHEN 'Q' THEN 4
          WHEN 'Y' THEN 5
          ELSE 6
        END,
        t.year DESC,
        t.month DESC
      LIMIT 1
    `

    try {
      const result = await db.query(query, [salesmanCode])

      if (result.rows.length > 0) {
        const amount = parseFloat(result.rows[0].amount) || 0

        // For daily targets, divide monthly by working days
        if (dateRange === 'today' || dateRange === 'yesterday') {
          return amount / 26 // Assuming 26 working days per month
        }

        return amount
      }

      // No target found, return 0 (will trigger fallback logic)
      return 0
    } catch (error) {
      console.error('Error fetching target for salesman', salesmanCode, ':', error)
      return 0
    }
  }

  /**
   * Get aggregate target for all salesmen for a time period
   */
  static async getAggregateTarget(
    dateRange: string,
    currentDate: Date = new Date()
  ): Promise<number> {
    await db.initialize()

    const year = currentDate.getFullYear()
    const month = currentDate.getMonth() + 1
    const quarter = Math.ceil(month / 3)

    let timeframeFilter = ''
    let dateFilter = ''

    switch(dateRange) {
      case 'today':
      case 'yesterday':
        timeframeFilter = `(t.timeframe = 'D' OR t.timeframe = 'M')`
        dateFilter = `t.year = ${year} AND t.month = ${month}`
        break

      case 'thisWeek':
      case 'lastWeek':
        timeframeFilter = `(t.timeframe = 'W' OR t.timeframe = 'M')`
        dateFilter = `t.year = ${year} AND t.month = ${month}`
        break

      case 'thisMonth':
        timeframeFilter = `t.timeframe = 'M'`
        dateFilter = `t.year = ${year} AND t.month = ${month}`
        break

      case 'lastMonth':
        const lastMonth = month === 1 ? 12 : month - 1
        const lastMonthYear = month === 1 ? year - 1 : year
        timeframeFilter = `t.timeframe = 'M'`
        dateFilter = `t.year = ${lastMonthYear} AND t.month = ${lastMonth}`
        break

      case 'lastQuarter':
        const lastQuarter = quarter === 1 ? 4 : quarter - 1
        const lastQuarterYear = quarter === 1 ? year - 1 : year

        // Calculate the months for last quarter
        let startMonth, endMonth
        if (lastQuarter === 1) {
          startMonth = 1; endMonth = 3
        } else if (lastQuarter === 2) {
          startMonth = 4; endMonth = 6
        } else if (lastQuarter === 3) {
          startMonth = 7; endMonth = 9
        } else {
          startMonth = 10; endMonth = 12
        }

        timeframeFilter = `(t.timeframe = 'Q' OR t.timeframe = 'M')`
        dateFilter = `t.year = ${lastQuarterYear} AND (t.quarter = ${lastQuarter} OR t.month IN (${startMonth}, ${startMonth + 1}, ${endMonth}))`
        break

      case 'thisYear':
        timeframeFilter = `(t.timeframe = 'Y' OR t.timeframe = 'M')`
        dateFilter = `t.year = ${year}`
        break

      case 'Q1':
        timeframeFilter = `t.timeframe = 'M'`
        dateFilter = `t.year = 2025 AND t.month IN (1, 2, 3)`
        break

      case 'Q2':
        timeframeFilter = `t.timeframe = 'M'`
        dateFilter = `t.year = 2025 AND t.month IN (4, 5, 6)`
        break

      case 'Q3':
        timeframeFilter = `t.timeframe = 'M'`
        dateFilter = `t.year = 2025 AND t.month IN (7, 8, 9)`
        break

      case 'Q4':
        timeframeFilter = `t.timeframe = 'M'`
        dateFilter = `t.year = 2025 AND t.month IN (10, 11, 12)`
        break

      default:
        timeframeFilter = `t.timeframe = 'M'`
        dateFilter = `t.year = ${year} AND t.month = ${month}`
    }

    const query = `
      SELECT SUM(t.amount) as total_target
      FROM tblcommontarget t
      WHERE t.isactive = true
        AND ${timeframeFilter}
        AND ${dateFilter}
        AND t.salesmancode IS NOT NULL
    `

    // Debug logging for lastQuarter
    if (dateRange === 'lastQuarter') {
      console.log('DEBUG - lastQuarter query:', {
        timeframeFilter,
        dateFilter,
        fullQuery: query
      })
    }

    try {
      const result = await db.query(query)
      const targetAmount = parseFloat(result.rows[0]?.total_target) || 0

      // Debug logging for lastQuarter result
      if (dateRange === 'lastQuarter') {
        console.log('DEBUG - lastQuarter result:', {
          rowCount: result.rows.length,
          totalTarget: result.rows[0]?.total_target,
          parsedAmount: targetAmount
        })
      }

      return targetAmount
    } catch (error) {
      console.error('Error fetching aggregate target:', error)
      return 0
    }
  }

  /**
   * Get targets for multiple salesmen
   */
  static async getTargetsForSalesmen(
    salesmanCodes: string[],
    dateRange: string,
    currentDate: Date = new Date()
  ): Promise<Map<string, number>> {
    if (salesmanCodes.length === 0) {
      return new Map()
    }

    await db.initialize()

    const year = currentDate.getFullYear()
    const month = currentDate.getMonth() + 1
    const quarter = Math.ceil(month / 3)

    let timeframeFilter = ''
    let dateFilter = ''

    switch(dateRange) {
      case 'today':
      case 'yesterday':
        // For daily targets, get monthly and we'll divide later
        timeframeFilter = `t.timeframe = 'M'`
        dateFilter = `t.year = ${year} AND t.month = ${month}`
        break
      case 'thisMonth':
        timeframeFilter = `t.timeframe = 'M'`
        dateFilter = `t.year = ${year} AND t.month = ${month}`
        break
      case 'lastMonth':
        const lastMonth = month === 1 ? 12 : month - 1
        const lastMonthYear = month === 1 ? year - 1 : year
        timeframeFilter = `t.timeframe = 'M'`
        dateFilter = `t.year = ${lastMonthYear} AND t.month = ${lastMonth}`
        break
      case 'thisYear':
        timeframeFilter = `(t.timeframe = 'Y' OR t.timeframe = 'M')`
        dateFilter = `t.year = ${year}`
        break
      default:
        timeframeFilter = `t.timeframe = 'M'`
        dateFilter = `t.year = ${year} AND t.month = ${month}`
    }

    const placeholders = salesmanCodes.map((_, i) => `$${i + 1}`).join(', ')

    const query = `
      SELECT t.salesmancode, t.amount
      FROM tblcommontarget t
      WHERE t.salesmancode IN (${placeholders})
        AND t.isactive = true
        AND ${timeframeFilter}
        AND ${dateFilter}
      ORDER BY t.salesmancode,
        CASE t.timeframe
          WHEN 'D' THEN 1
          WHEN 'W' THEN 2
          WHEN 'M' THEN 3
          WHEN 'Q' THEN 4
          WHEN 'Y' THEN 5
          ELSE 6
        END
    `

    try {
      const result = await db.query(query, salesmanCodes)
      const targetsMap = new Map<string, number>()

      result.rows.forEach(row => {
        const salesmanCode = row.salesmancode
        if (!targetsMap.has(salesmanCode)) {
          let amount = parseFloat(row.amount) || 0

          // For daily targets, divide monthly by working days
          if (dateRange === 'today' || dateRange === 'yesterday') {
            amount = amount / 26 // Assuming 26 working days per month
          }

          targetsMap.set(salesmanCode, amount)
        }
      })

      return targetsMap
    } catch (error) {
      console.error('Error fetching targets for salesmen:', error)
      return new Map()
    }
  }

  /**
   * Calculate fallback target based on historical performance
   */
  static calculateFallbackTarget(actualSales: number, growthRate: number = 0.1): number {
    return actualSales * (1 + growthRate)
  }

  /**
   * Get target with fallback logic
   */
  static async getTargetWithFallback(
    salesmanCode: string,
    dateRange: string,
    actualSales: number,
    currentDate: Date = new Date()
  ): Promise<number> {
    const target = await this.getTargetForPeriod(salesmanCode, dateRange, currentDate)

    if (target > 0) {
      return target
    }

    // Fallback to calculated target with 10% growth
    return this.calculateFallbackTarget(actualSales, 0.1)
  }
}