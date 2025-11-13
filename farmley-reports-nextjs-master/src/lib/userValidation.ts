/**
 * User Validation Service
 * Central service to validate users and prevent unauthorized access
 */

import { getChildUsers, isAdmin } from './mssql'

// Cache for validated users to avoid repeated MSSQL calls
const userValidationCache = new Map<string, boolean>()
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

interface ValidationResult {
  isValid: boolean
  error?: string
  childUsers?: string[]
}

/**
 * Validate if a user exists in the system hierarchy
 * Returns true if valid, redirects to error page if not
 */
export async function validateUser(userCode: string | null | undefined): Promise<ValidationResult> {
  // If no user code provided, treat as admin
  if (!userCode || userCode === 'admin') {
    return { isValid: true, childUsers: [] }
  }
  
  // Check cache first
  const cacheKey = `${userCode}_${Date.now()}`
  const cached = userValidationCache.get(userCode)
  
  if (cached !== undefined) {
    if (cached) {
      return { isValid: true }
    } else {
      // User was already validated as invalid
      if (typeof window !== 'undefined') {
        window.location.href = `/user-not-found?userCode=${userCode}`
      }
      return { isValid: false, error: `User ${userCode} not found` }
    }
  }
  
  try {
    // Check if admin
    if (isAdmin(userCode)) {
      userValidationCache.set(userCode, true)
      return { isValid: true, childUsers: [] }
    }
    
    // Validate user exists in hierarchy
    const childUsers = await getChildUsers(userCode)
    
    // User is valid
    userValidationCache.set(userCode, true)
    
    // Clear cache after duration
    setTimeout(() => {
      userValidationCache.delete(userCode)
    }, CACHE_DURATION)
    
    return { isValid: true, childUsers }
    
  } catch (error: any) {
    // Check if it's USER_NOT_FOUND error
    if (error.message && error.message.includes('USER_NOT_FOUND')) {
      userValidationCache.set(userCode, false)
      
      // Redirect to error page
      if (typeof window !== 'undefined') {
        window.location.href = `/user-not-found?userCode=${userCode}`
      }
      
      return { 
        isValid: false, 
        error: `User ${userCode} not found in the system` 
      }
    }
    
    // Other errors - still treat as invalid for safety
    console.error('User validation error:', error)
    return { 
      isValid: false, 
      error: 'Failed to validate user' 
    }
  }
}

/**
 * Hook to validate user on component mount
 * Prevents any rendering if user is invalid
 */
export function useUserValidation(userCode: string | null | undefined) {
  if (typeof window === 'undefined') return true // SSR
  
  // Synchronous check for immediate redirect
  const cached = userValidationCache.get(userCode || 'admin')
  if (cached === false) {
    window.location.href = `/user-not-found?userCode=${userCode}`
    return false
  }
  
  return true
}
