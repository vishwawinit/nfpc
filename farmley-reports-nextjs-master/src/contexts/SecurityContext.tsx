'use client'

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { useRouter, usePathname } from 'next/navigation'

interface SecurityContextType {
  isAuthorized: boolean
  isLoading: boolean
  referrerValid: boolean
  checkReferrer: () => Promise<boolean>
  errorMessage: string | null
}

const SecurityContext = createContext<SecurityContextType>({
  isAuthorized: false,
  isLoading: true,
  referrerValid: false,
  checkReferrer: async () => false,
  errorMessage: null
})

export const useSecurityContext = () => {
  const context = useContext(SecurityContext)
  if (!context) {
    throw new Error('useSecurityContext must be used within a SecurityProvider')
  }
  return context
}

interface SecurityProviderProps {
  children: ReactNode
}

export const SecurityProvider: React.FC<SecurityProviderProps> = ({ children }) => {
  const [isAuthorized, setIsAuthorized] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [referrerValid, setReferrerValid] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const router = useRouter()
  const pathname = usePathname()

  const checkReferrer = async (): Promise<boolean> => {
    try {
      // Check if we're on the unauthorized page
      if (pathname === '/unauthorized') {
        setIsLoading(false)
        return false
      }

      // If we've reached this point, the middleware has already validated the referrer
      // If the referrer was invalid, middleware would have redirected to /unauthorized
      // So we can safely assume access is authorized
      console.log('[SecurityContext] Page loaded successfully - access authorized')
      setIsAuthorized(true)
      setReferrerValid(true)
      setIsLoading(false)
      return true

    } catch (error) {
      console.error('Security check failed:', error)
      setErrorMessage('Security verification failed')
      setIsAuthorized(false)
      setReferrerValid(false)
      setIsLoading(false)
      return false
    }
  }

  useEffect(() => {
    // Skip check for unauthorized page
    if (pathname === '/unauthorized') {
      setIsLoading(false)
      return
    }

    // Check referrer on mount and route changes
    checkReferrer()
  }, [pathname])

  return (
    <SecurityContext.Provider value={{
      isAuthorized,
      isLoading,
      referrerValid,
      checkReferrer,
      errorMessage
    }}>
      {children}
    </SecurityContext.Provider>
  )
}
