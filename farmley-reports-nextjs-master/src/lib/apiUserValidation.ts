/**
 * API User Validation Helper
 * Validates user access for API routes and returns proper error responses
 */

import { NextResponse } from 'next/server'
import { getChildUsers, isAdmin } from './mssql'

interface UserValidationResult {
  isValid: boolean
  userCode: string
  childUsers?: string[]
  error?: string
  response?: NextResponse
}

/**
 * Validate user for API access
 * Returns validation result with child users if valid
 * Returns NextResponse with error if invalid
 */
export async function validateApiUser(loginUserCode: string | null): Promise<UserValidationResult> {
  // If no user code or admin, allow access
  if (!loginUserCode || loginUserCode === 'admin' || isAdmin(loginUserCode)) {
    return {
      isValid: true,
      userCode: loginUserCode || 'admin',
      childUsers: []
    }
  }
  
  try {
    // Validate user exists in hierarchy
    const childUsers = await getChildUsers(loginUserCode)
    
    return {
      isValid: true,
      userCode: loginUserCode,
      childUsers
    }
  } catch (error: any) {
    // Check if it's USER_NOT_FOUND error
    if (error.message && error.message.includes('USER_NOT_FOUND')) {
      console.error(`API Access Denied: User ${loginUserCode} not found in hierarchy`)
      
      return {
        isValid: false,
        userCode: loginUserCode,
        error: `User ${loginUserCode} not found in the system`,
        response: NextResponse.json({
          success: false,
          error: `User ${loginUserCode} not found in the system. Please contact your administrator.`,
          isUserNotFound: true
        }, { status: 404 })
      }
    }
    
    // Other errors - return server error
    console.error('User validation error in API:', error)
    return {
      isValid: false,
      userCode: loginUserCode,
      error: 'Failed to validate user',
      response: NextResponse.json({
        success: false,
        error: 'Failed to validate user access'
      }, { status: 500 })
    }
  }
}

/**
 * Get allowed user codes for filtering
 * Returns empty array for admin, otherwise returns child users
 */
export async function getAllowedUserCodes(loginUserCode: string | null): Promise<string[]> {
  if (!loginUserCode || loginUserCode === 'admin' || isAdmin(loginUserCode)) {
    return []
  }
  
  try {
    const childUsers = await getChildUsers(loginUserCode)
    return childUsers
  } catch (error: any) {
    // If user not found, return empty array (will be caught elsewhere)
    if (error.message && error.message.includes('USER_NOT_FOUND')) {
      return []
    }
    console.error('Error getting allowed user codes:', error)
    return []
  }
}
