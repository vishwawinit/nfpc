import { NextResponse } from 'next/server'
import { getUsers } from '@/services/attendanceService'

export async function GET(request: Request) {
  try {
    const data = await getUsers()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error in users API:', error)
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    )
  }
}
