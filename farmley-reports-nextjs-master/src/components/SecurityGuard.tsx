'use client'

import React, { ReactNode } from 'react'
import { useSecurityContext } from '@/contexts/SecurityContext'
import { Loader2, ShieldOff, AlertTriangle } from 'lucide-react'

interface SecurityGuardProps {
  children: ReactNode
  fallback?: ReactNode
}

export const SecurityGuard: React.FC<SecurityGuardProps> = ({ children, fallback }) => {
  const { isAuthorized, isLoading, errorMessage } = useSecurityContext()

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-gray-700">Verifying Security...</h2>
          <p className="text-sm text-gray-500 mt-1">Please wait while we validate your access</p>
        </div>
      </div>
    )
  }

  // Unauthorized state
  if (!isAuthorized) {
    if (fallback) {
      return <>{fallback}</>
    }

    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-lg shadow-lg p-8">
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                <ShieldOff className="w-8 h-8 text-red-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">Access Denied</h2>
              <p className="text-gray-600 text-center mb-4">
                {errorMessage || 'You must access this application through the main website.'}
              </p>
              
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 w-full">
                <div className="flex items-start">
                  <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5 mr-2 flex-shrink-0" />
                  <div>
                    <p className="text-sm text-yellow-800">
                      For security reasons, this application can only be accessed through the official company portal.
                    </p>
                  </div>
                </div>
              </div>

              <button
                onClick={() => {
                  const mainSite = process.env.NEXT_PUBLIC_ALLOWED_REFERRER || 'http://localhost:3000'
                  window.location.href = mainSite
                }}
                className="mt-6 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Go to Main Website
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Authorized - render children
  return <>{children}</>
}
