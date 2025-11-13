import { NextResponse } from 'next/server'

export async function GET() {
  const forceProduction = process.env.FORCE_PRODUCTION === 'true'
  const effectiveMode = process.env.NODE_ENV === 'development' && !forceProduction ? 'development' : 'production'
  
  return NextResponse.json({
    NODE_ENV: process.env.NODE_ENV,
    FORCE_PRODUCTION: process.env.FORCE_PRODUCTION,
    EFFECTIVE_MODE: effectiveMode,
    ALLOWED_REFERRERS: process.env.ALLOWED_REFERRERS,
    ALLOWED_REFERRERS_ARRAY: process.env.ALLOWED_REFERRERS?.split(','),
    timestamp: new Date().toISOString()
  })
}
