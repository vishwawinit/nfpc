// Daily Sales Export API - GET Excel export with enhanced formatting
import { NextRequest, NextResponse } from 'next/server'
import {
  getDailySalesSummary,
  getTransactionDetails
} from '@/services/dailySalesService'
import * as XLSX from 'xlsx'

// Force dynamic rendering for routes that use searchParams
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams

    const filters: any = {
      startDate: searchParams.get('startDate') || undefined,
      endDate: searchParams.get('endDate') || undefined,
      userCode: searchParams.get('userCode') || undefined,
      teamLeaderCode: searchParams.get('teamLeaderCode') || undefined,
      fieldUserRole: searchParams.get('fieldUserRole') || undefined,
      storeCode: searchParams.get('storeCode') || undefined,
      productCode: searchParams.get('productCode') || undefined,
      productCategory: searchParams.get('productCategory') || undefined,
      regionCode: searchParams.get('regionCode') || undefined,
      chainName: searchParams.get('chainName') || undefined
    }

    // Fetch all data - get ALL transactions without limit
    const [summary, transactions] = await Promise.all([
      getDailySalesSummary(filters),
      getTransactionDetails(filters) // This will get ALL transactions
    ])

    // Create workbook
    const workbook = XLSX.utils.book_new()

    // ==================== SHEET 1: SUMMARY & REPORT INFO ====================
    const reportInfo = [
      ['DAILY SALES REPORT'], // Title row
      [''],
      ['Report Generated:', new Date().toLocaleString('en-IN', { dateStyle: 'full', timeStyle: 'short' })],
      ['Currency:', summary.currencyCode || 'INR'],
      [''],
      ['APPLIED FILTERS'],
      ['Date Range:', `${filters.startDate || 'All Dates'} to ${filters.endDate || 'All Dates'}`],
    ]

    if (filters.regionCode) reportInfo.push(['Region:', filters.regionCode])
    if (filters.teamLeaderCode) reportInfo.push(['Team Leader Code:', filters.teamLeaderCode])
    if (filters.fieldUserRole) reportInfo.push(['Field User Role:', filters.fieldUserRole])
    if (filters.userCode) reportInfo.push(['User Code:', filters.userCode])
    if (filters.chainName) reportInfo.push(['Chain Name:', filters.chainName])
    if (filters.storeCode) reportInfo.push(['Store Code:', filters.storeCode])
    if (filters.productCode) reportInfo.push(['Product Code:', filters.productCode])
    if (filters.productCategory) reportInfo.push(['Product Category:', filters.productCategory])

    reportInfo.push([''])
    reportInfo.push(['KEY PERFORMANCE INDICATORS'])
    reportInfo.push([''])
    reportInfo.push(['Metric', 'Value'])
    reportInfo.push(['Total Orders', summary.totalOrders?.toLocaleString('en-IN') || 0])
    reportInfo.push(['Total Stores', summary.totalStores?.toLocaleString('en-IN') || 0])
    reportInfo.push(['Total Products', summary.totalProducts?.toLocaleString('en-IN') || 0])
    reportInfo.push(['Total Field Users', summary.totalUsers?.toLocaleString('en-IN') || 0])
    reportInfo.push(['Total Quantity', summary.totalQuantity?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || 0])
    reportInfo.push(['Gross Sales', summary.totalSales?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || 0])
    reportInfo.push(['Total Discount', summary.totalDiscount?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || 0])
    reportInfo.push(['Net Sales', summary.totalNetSales?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || 0])
    reportInfo.push(['Average Order Value', summary.avgOrderValue?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || 0])

    const infoSheet = XLSX.utils.aoa_to_sheet(reportInfo)

    // Set column widths for Summary sheet
    infoSheet['!cols'] = [
      { wch: 30 }, // Column A - Labels
      { wch: 40 }  // Column B - Values
    ]

    XLSX.utils.book_append_sheet(workbook, infoSheet, 'Summary')

    // ==================== SHEET 2: ALL TRANSACTIONS ====================
    const transactionsData = transactions.map((trx: any) => ({
      'Transaction Code': trx.trxCode,
      'Date': new Date(trx.trxDateOnly).toLocaleDateString('en-IN'),
      'Field User Code': trx.fieldUserCode,
      'Field User Name': trx.fieldUserName,
      'Field User Role': trx.fieldUserRole,
      'TL Code': trx.tlCode || '-',
      'TL Name': trx.tlName || '-',
      'Region': trx.regionCode || '-',
      'City': trx.cityCode ? trx.cityCode.split('_').slice(1).join('_') || trx.cityCode : '-',
      'Store Code': trx.storeCode,
      'Store Name': trx.storeName,
      'Product Code': trx.productCode,
      'Product Name': trx.productName,
      'Category': trx.productCategory,
      'Quantity': Number(trx.quantity).toFixed(2),
      'Unit Price': Number(trx.unitPrice).toFixed(2),
      'Total Amount': Number(trx.lineAmount).toFixed(2)
    }))

    const transactionsSheet = XLSX.utils.json_to_sheet(transactionsData)

    // Set column widths for Transactions sheet
    transactionsSheet['!cols'] = [
      { wch: 18 },  // Transaction Code
      { wch: 12 },  // Date
      { wch: 16 },  // Field User Code
      { wch: 25 },  // Field User Name
      { wch: 18 },  // Field User Role
      { wch: 12 },  // TL Code
      { wch: 25 },  // TL Name
      { wch: 12 },  // Region
      { wch: 20 },  // City
      { wch: 15 },  // Store Code
      { wch: 30 },  // Store Name
      { wch: 15 },  // Product Code
      { wch: 35 },  // Product Name
      { wch: 18 },  // Category
      { wch: 12 },  // Quantity
      { wch: 14 },  // Unit Price
      { wch: 16 }   // Total Amount
    ]

    XLSX.utils.book_append_sheet(workbook, transactionsSheet, 'Transactions')

    // Generate buffer with cellStyles enabled
    const buffer = XLSX.write(workbook, {
      type: 'buffer',
      bookType: 'xlsx',
      cellStyles: true
    })

    // Return as downloadable file with descriptive filename
    const dateStr = filters.startDate && filters.endDate
      ? `${filters.startDate}_to_${filters.endDate}`
      : new Date().toISOString().split('T')[0]
    const filename = `NFPC_Daily_Sales_Report_${dateStr}.xlsx`

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': buffer.length.toString()
      }
    })
  } catch (error) {
    console.error('Daily Sales Export API error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to export daily sales report',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
