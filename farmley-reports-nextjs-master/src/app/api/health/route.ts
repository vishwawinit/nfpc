import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  // This is a public health check endpoint
  // It's used by SecurityContext to verify the app is running
  // The middleware skips this endpoint, so we always return success
  
  return NextResponse.json(
    { 
      status: 'ok',
      message: 'Application is running',
      timestamp: new Date().toISOString()
    },
    { 
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'x-referrer-valid': 'true'
      }
    }
  )
}
