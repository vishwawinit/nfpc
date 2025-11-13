import { NextRequest, NextResponse } from 'next/server'

/**
 * Wrapper function to check referrer validity for API routes
 * This adds an extra layer of security to ensure API calls come from valid sources
 */
export function withReferrerCheck(
  handler: (request: NextRequest) => Promise<NextResponse>
) {
  return async function(request: NextRequest): Promise<NextResponse> {
    // Check if the referrer is valid (set by middleware)
    const referrerValid = request.headers.get('x-referrer-valid') === 'true'
    
    // In development, allow bypass for testing
    const isDevelopment = process.env.NODE_ENV === 'development'
    const bypassHeader = request.headers.get('x-bypass-referrer-check')
    
    if (isDevelopment && bypassHeader === 'development-mode') {
      // Allow access in development mode with bypass header
      return handler(request)
    }
    
    // If referrer is not valid, return unauthorized
    if (!referrerValid) {
      console.log('[API Security] Invalid referrer for:', request.url)
      return NextResponse.json(
        {
          error: 'Unauthorized Access',
          message: 'You must access this API through the authorized application.',
          code: 'INVALID_REFERRER',
          timestamp: new Date().toISOString()
        },
        { 
          status: 403,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-store, no-cache, must-revalidate',
          }
        }
      )
    }
    
    // If valid, proceed with the original handler
    return handler(request)
  }
}

/**
 * Check if a request has a valid referrer
 * Use this for conditional logic in API routes
 */
export function isValidReferrer(request: NextRequest): boolean {
  const referrerValid = request.headers.get('x-referrer-valid') === 'true'
  const isDevelopment = process.env.NODE_ENV === 'development'
  const bypassHeader = request.headers.get('x-bypass-referrer-check')
  
  if (isDevelopment && bypassHeader === 'development-mode') {
    return true
  }
  
  return referrerValid
}
