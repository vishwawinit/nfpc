/**
 * Caching Utilities for Next.js API Routes
 * Provides intelligent cache duration based on date ranges and data types
 */

/**
 * Get cache duration based on date range
 * @param dateRange - The date range string (today, yesterday, thisWeek, etc.)
 * @param hasCustomDates - Whether custom start/end dates are provided
 * @returns Cache duration in seconds
 */
export function getCacheDuration(dateRange: string, hasCustomDates: boolean = false): number {
  // Custom dates get medium cache (15 minutes)
  if (hasCustomDates) {
    return 900
  }
  
  switch(dateRange.toLowerCase()) {
    // Short cache - Changes frequently
    case 'today':
    case 'yesterday':
      return 600 // 10 minutes
    
    // Medium cache - Moderately dynamic
    case 'thisweek':
    case 'lastweek':
    case 'last7days':
      return 900 // 15 minutes
    
    // Long cache - Daily updates
    case 'thismonth':
    case 'last30days':
      return 1800 // 30 minutes
    
    // Extended cache - Historical data (stable)
    case 'lastmonth':
    case 'thisquarter':
    case 'lastquarter':
    case 'thisyear':
    case 'lastyear':
      return 3600 // 60 minutes
    
    // Default medium cache
    default:
      return 900 // 15 minutes
  }
}

/**
 * Standard cache duration for filters (15 minutes)
 */
export const FILTERS_CACHE_DURATION = 900

/**
 * Standard cache duration for static/configuration data (30 minutes)
 */
export const STATIC_CACHE_DURATION = 1800

/**
 * Generate Cache-Control header value
 * @param cacheDuration - Cache duration in seconds
 * @returns Cache-Control header value
 */
export function getCacheControlHeader(cacheDuration: number): string {
  const staleWhileRevalidate = cacheDuration * 2
  return `public, s-maxage=${cacheDuration}, stale-while-revalidate=${staleWhileRevalidate}`
}

/**
 * Create cache info object for response
 * @param cacheDuration - Cache duration in seconds
 * @param dateRange - Optional date range
 * @param hasCustomDates - Optional custom dates flag
 * @returns Cache info object
 */
export function createCacheInfo(
  cacheDuration: number,
  dateRange?: string,
  hasCustomDates?: boolean
) {
  return {
    duration: cacheDuration,
    ...(dateRange && { dateRange }),
    ...(hasCustomDates !== undefined && { hasCustomDates })
  }
}

/**
 * Add caching to a NextResponse JSON object
 * @param data - The response data object
 * @param cacheDuration - Cache duration in seconds
 * @param additionalInfo - Additional cache metadata
 * @returns Object with data and headers for NextResponse
 */
export function createCachedResponse(
  data: any,
  cacheDuration: number,
  additionalInfo?: { dateRange?: string; hasCustomDates?: boolean }
) {
  return {
    body: {
      ...data,
      cached: true,
      cacheInfo: createCacheInfo(
        cacheDuration,
        additionalInfo?.dateRange,
        additionalInfo?.hasCustomDates
      )
    },
    headers: {
      'Cache-Control': getCacheControlHeader(cacheDuration)
    }
  }
}
