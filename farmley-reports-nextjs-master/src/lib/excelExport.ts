// Excel Export Utility using ExcelJS
// Provides functions to export report data to Excel format

import ExcelJS from 'exceljs'

export interface ExcelColumn {
  header: string
  key: string
  width?: number
  style?: Partial<ExcelJS.Style>
}

export interface ExcelExportOptions {
  sheetName: string
  columns: ExcelColumn[]
  data: any[]
  title?: string
  filters?: Record<string, any>
  includeTimestamp?: boolean
  autoFilter?: boolean
  freezeHeader?: boolean
}

// ============================================================================
// MAIN EXPORT FUNCTION
// ============================================================================

export async function exportToExcel(options: ExcelExportOptions): Promise<Buffer> {
  const { sheetName, columns, data, title, filters, includeTimestamp = true, autoFilter = true, freezeHeader = true } = options

  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'NFPC Reports'
  workbook.created = new Date()

  const worksheet = workbook.addWorksheet(sheetName, {
    views: [{ state: 'frozen', xSplit: 0, ySplit: freezeHeader ? (title ? 4 : 2) : 0 }]
  })

  let currentRow = 1

  // Add title if provided
  if (title) {
    const titleRow = worksheet.addRow([title])
    titleRow.font = { size: 16, bold: true, color: { argb: 'FF2E7D32' } }
    titleRow.alignment = { horizontal: 'center', vertical: 'middle' }
    worksheet.mergeCells(`A1:${String.fromCharCode(64 + columns.length)}1`)
    titleRow.height = 30
    currentRow++
  }

  // Add filters applied section
  if (filters && Object.keys(filters).length > 0) {
    const filtersRow = worksheet.addRow(['Filters Applied:'])
    filtersRow.font = { bold: true, size: 11 }
    currentRow++

    for (const [key, value] of Object.entries(filters)) {
      if (value) {
        const filterRow = worksheet.addRow([`  ${key}:`, value])
        filterRow.font = { size: 10 }
        currentRow++
      }
    }

    currentRow++ // Empty row after filters
  }

  // Add timestamp
  if (includeTimestamp) {
    const timestampRow = worksheet.addRow(['Generated:', new Date().toLocaleString('en-AE')])
    timestampRow.font = { size: 10, italic: true }
    currentRow++
    currentRow++ // Empty row
  }

  // Add header row with styling
  const headerRow = worksheet.addRow(columns.map(col => col.header))
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 }
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1976D2' }
  }
  headerRow.alignment = { horizontal: 'center', vertical: 'middle' }
  headerRow.height = 20

  // Set column widths and keys
  columns.forEach((col, index) => {
    const column = worksheet.getColumn(index + 1)
    column.key = col.key
    column.width = col.width || 15

    if (col.style) {
      column.style = col.style
    }
  })

  // Add data rows
  data.forEach(row => {
    const dataRow = worksheet.addRow(
      columns.map(col => {
        const value = row[col.key]
        // Format values
        if (value === null || value === undefined) return ''
        if (typeof value === 'number') return value
        return String(value)
      })
    )

    // Alternating row colors
    dataRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: dataRow.number % 2 === 0 ? 'FFF5F5F5' : 'FFFFFFFF' }
    }

    // Add borders
    dataRow.eachCell(cell => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE0E0E0' } },
        left: { style: 'thin', color: { argb: 'FFE0E0E0' } },
        bottom: { style: 'thin', color: { argb: 'FFE0E0E0' } },
        right: { style: 'thin', color: { argb: 'FFE0E0E0' } }
      }
    })
  })

  // Add autofilter
  if (autoFilter && data.length > 0) {
    const headerRowNumber = currentRow
    worksheet.autoFilter = {
      from: { row: headerRowNumber, column: 1 },
      to: { row: headerRowNumber, column: columns.length }
    }
  }

  // Add summary row at the end
  if (data.length > 0) {
    const summaryRow = worksheet.addRow([])
    summaryRow.getCell(1).value = `Total Records: ${data.length}`
    summaryRow.font = { bold: true, size: 10 }
  }

  // Generate buffer
  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(buffer)
}

// ============================================================================
// MULTI-SHEET EXPORT
// ============================================================================

export interface MultiSheetOptions {
  fileName?: string
  sheets: ExcelExportOptions[]
}

export async function exportMultiSheetExcel(options: MultiSheetOptions): Promise<Buffer> {
  const { sheets } = options

  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'NFPC Reports'
  workbook.created = new Date()

  for (const sheetOptions of sheets) {
    const worksheet = workbook.addWorksheet(sheetOptions.sheetName, {
      views: [{ state: 'frozen', xSplit: 0, ySplit: sheetOptions.freezeHeader ? 2 : 0 }]
    })

    let currentRow = 1

    // Add title
    if (sheetOptions.title) {
      const titleRow = worksheet.addRow([sheetOptions.title])
      titleRow.font = { size: 16, bold: true, color: { argb: 'FF2E7D32' } }
      titleRow.alignment = { horizontal: 'center' }
      worksheet.mergeCells(`A1:${String.fromCharCode(64 + sheetOptions.columns.length)}1`)
      currentRow++
      currentRow++ // Empty row
    }

    // Add header
    const headerRow = worksheet.addRow(sheetOptions.columns.map(col => col.header))
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1976D2' }
    }

    // Set column widths
    sheetOptions.columns.forEach((col, index) => {
      const column = worksheet.getColumn(index + 1)
      column.key = col.key
      column.width = col.width || 15
    })

    // Add data
    sheetOptions.data.forEach(row => {
      worksheet.addRow(sheetOptions.columns.map(col => row[col.key] || ''))
    })
  }

  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(buffer)
}

// ============================================================================
// SPECIALIZED EXPORT FUNCTIONS FOR DIFFERENT REPORTS
// ============================================================================

export async function exportDailySalesReport(data: {
  summary: any
  products: any[]
  stores: any[]
  users: any[]
  transactions: any[]
  filters: Record<string, any>
}): Promise<Buffer> {
  const sheets: ExcelExportOptions[] = [
    {
      sheetName: 'Summary',
      columns: [
        { header: 'Metric', key: 'metric', width: 25 },
        { header: 'Value', key: 'value', width: 20 }
      ],
      data: [
        { metric: 'Total Sales', value: data.summary.totalSales },
        { metric: 'Total Net Sales', value: data.summary.totalNetSales },
        { metric: 'Total Discount', value: data.summary.totalDiscount },
        { metric: 'Total Orders', value: data.summary.totalOrders },
        { metric: 'Total Quantity', value: data.summary.totalQuantity },
        { metric: 'Total Stores', value: data.summary.totalStores },
        { metric: 'Total Products', value: data.summary.totalProducts },
        { metric: 'Total Users', value: data.summary.totalUsers }
      ],
      title: 'Daily Sales Summary',
      filters: data.filters,
      includeTimestamp: true
    },
    {
      sheetName: 'Product Performance',
      columns: [
        { header: 'Product Code', key: 'productCode', width: 15 },
        { header: 'Product Name', key: 'productName', width: 30 },
        { header: 'Category', key: 'productCategory', width: 20 },
        { header: 'Quantity', key: 'quantity', width: 15 },
        { header: 'Sales', key: 'sales', width: 15 },
        { header: 'Discount', key: 'discount', width: 15 },
        { header: 'Net Sales', key: 'netSales', width: 15 },
        { header: 'Orders', key: 'orders', width: 10 },
        { header: 'Stores', key: 'stores', width: 10 }
      ],
      data: data.products,
      title: 'Product Performance',
      autoFilter: true
    },
    {
      sheetName: 'Store Performance',
      columns: [
        { header: 'Store Code', key: 'storeCode', width: 15 },
        { header: 'Store Name', key: 'storeName', width: 30 },
        { header: 'Classification', key: 'storeClass', width: 20 },
        { header: 'City', key: 'cityCode', width: 15 },
        { header: 'Region', key: 'regionCode', width: 15 },
        { header: 'Quantity', key: 'quantity', width: 15 },
        { header: 'Net Sales', key: 'netSales', width: 15 },
        { header: 'Orders', key: 'orders', width: 10 },
        { header: 'Products', key: 'products', width: 10 }
      ],
      data: data.stores,
      title: 'Store Performance',
      autoFilter: true
    },
    {
      sheetName: 'User Performance',
      columns: [
        { header: 'User Code', key: 'userCode', width: 15 },
        { header: 'User Name', key: 'userName', width: 25 },
        { header: 'User Type', key: 'userType', width: 20 },
        { header: 'Quantity', key: 'quantity', width: 15 },
        { header: 'Net Sales', key: 'netSales', width: 15 },
        { header: 'Orders', key: 'orders', width: 10 },
        { header: 'Stores', key: 'stores', width: 10 },
        { header: 'Products', key: 'products', width: 10 },
        { header: 'Avg Order Value', key: 'avgOrderValue', width: 15 }
      ],
      data: data.users,
      title: 'User Performance',
      autoFilter: true
    }
  ]

  if (data.transactions && data.transactions.length > 0) {
    sheets.push({
      sheetName: 'Transactions',
      columns: [
        { header: 'Date', key: 'trx_date_only', width: 12 },
        { header: 'Trx Code', key: 'trx_code', width: 15 },
        { header: 'Store Code', key: 'store_code', width: 12 },
        { header: 'Store Name', key: 'store_name', width: 25 },
        { header: 'User Code', key: 'field_user_code', width: 12 },
        { header: 'User Name', key: 'field_user_name', width: 20 },
        { header: 'Product Code', key: 'product_code', width: 12 },
        { header: 'Product Name', key: 'product_name', width: 25 },
        { header: 'Quantity', key: 'quantity', width: 10 },
        { header: 'Unit Price', key: 'unit_price', width: 12 },
        { header: 'Discount %', key: 'discount_percentage', width: 10 },
        { header: 'Net Amount', key: 'net_amount', width: 15 }
      ],
      data: data.transactions,
      title: 'Transaction Details',
      autoFilter: true
    })
  }

  return exportMultiSheetExcel({ sheets })
}

export async function exportAttendanceReport(data: {
  analytics: any[]
  filters: Record<string, any>
}): Promise<Buffer> {
  return exportToExcel({
    sheetName: 'Attendance Analytics',
    columns: [
      { header: 'User Code', key: 'userCode', width: 15 },
      { header: 'User Name', key: 'userName', width: 25 },
      { header: 'Role', key: 'role', width: 20 },
      { header: 'Attendance %', key: 'attendancePercentage', width: 15 },
      { header: 'Present Days', key: 'presentDays', width: 12 },
      { header: 'Absent Days', key: 'absentDays', width: 12 },
      { header: 'Leave Days', key: 'leaveDays', width: 12 },
      { header: 'Working Hours', key: 'totalWorkingHours', width: 15 },
      { header: 'Productive Hours', key: 'totalProductiveHours', width: 15 },
      { header: 'Efficiency %', key: 'avgEfficiency', width: 12 }
    ],
    data: data.analytics,
    title: 'Attendance Analytics Report',
    filters: data.filters,
    includeTimestamp: true,
    autoFilter: true
  })
}
