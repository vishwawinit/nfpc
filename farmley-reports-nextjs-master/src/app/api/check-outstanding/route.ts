import { NextResponse } from 'next/server'
import { db } from '@/lib/database'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // Get column information
    const columns = await db.getTableSchema('new_flat_outstanding_invoices')

    // Get row count
    const countResult = await db.query('SELECT COUNT(*) FROM new_flat_outstanding_invoices')
    const totalRows = countResult.rows[0].count

    // Get sample data
    const sampleResult = await db.query('SELECT * FROM new_flat_outstanding_invoices LIMIT 3')

    // Group columns by type
    const dateColumns = columns.filter(col =>
      col.data_type.includes('date') || col.data_type.includes('timestamp')
    )

    const amountColumns = columns.filter(col =>
      col.column_name.toLowerCase().includes('amount') ||
      col.column_name.toLowerCase().includes('value') ||
      col.column_name.toLowerCase().includes('total') ||
      col.data_type.includes('numeric') ||
      col.data_type.includes('decimal')
    )

    const customerColumns = columns.filter(col =>
      col.column_name.toLowerCase().includes('customer') ||
      col.column_name.toLowerCase().includes('salesman') ||
      col.column_name.toLowerCase().includes('route')
    )

    const agingColumns = columns.filter(col =>
      col.column_name.toLowerCase().includes('aging') ||
      col.column_name.toLowerCase().includes('bucket') ||
      col.column_name.toLowerCase().includes('days') ||
      col.column_name.toLowerCase().includes('outstanding')
    )

    // Try to find the amount column and calculate total
    let totalOutstanding = 0
    const possibleAmountColumns = ['outstanding_amount', 'invoice_amount', 'total_amount', 'amount']

    for (const colName of possibleAmountColumns) {
      try {
        const result = await db.query(`SELECT SUM(${colName}) as total FROM new_flat_outstanding_invoices`)
        if (result.rows[0].total) {
          totalOutstanding = parseFloat(result.rows[0].total)
          break
        }
      } catch (err) {
        // Column doesn't exist, try next one
        continue
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        tableName: 'new_flat_outstanding_invoices',
        totalRows,
        totalOutstanding,
        columns: {
          all: columns.map(col => ({
            name: col.column_name,
            type: col.data_type,
            nullable: col.is_nullable
          })),
          dates: dateColumns.map(col => col.column_name),
          amounts: amountColumns.map(col => col.column_name),
          customers: customerColumns.map(col => col.column_name),
          aging: agingColumns.map(col => col.column_name)
        },
        sampleData: sampleResult.rows
      }
    })
  } catch (error: any) {
    console.error('Error checking outstanding table:', error)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}
