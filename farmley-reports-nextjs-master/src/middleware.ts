import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Authentication/Referrer checks disabled: allow all requests
export function middleware(request: NextRequest) {
  return NextResponse.next()
}

// Configure which paths the middleware should run on
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|public/).*)'],
}
