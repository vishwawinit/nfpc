import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/database'

export async function GET(request: NextRequest) {
  try {
    const schema = await db.getTableSchema('tblcustomer')

    return NextResponse.json({
      columns: schema
    })

  } catch (error) {
    console.error('Error checking customer table:', error)
    return NextResponse.json(
      { error: 'Failed to check customer table' },
      { status: 500 }
    )
  }
}