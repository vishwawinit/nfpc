'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { AlertTriangle, Home, Phone, Mail } from 'lucide-react'

function UserNotFoundContent() {
  const searchParams = useSearchParams()
  const userCode = searchParams.get('userCode') || 'Unknown'
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        {/* Main Card */}
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          {/* Header with gradient */}
          <div className="bg-gradient-to-r from-red-600 to-orange-600 p-8 text-white">
            <div className="flex items-center justify-center mb-4">
              <div className="bg-white/20 p-4 rounded-full">
                <AlertTriangle className="w-12 h-12 text-white" />
              </div>
            </div>
            <h1 className="text-3xl font-bold text-center mb-2">Access Denied</h1>
            <p className="text-center text-white/90">User Authentication Failed</p>
          </div>
          
          {/* Content */}
          <div className="p-8">
            <div className="bg-red-50 border-l-4 border-red-500 p-6 mb-6 rounded-r-lg">
              <h2 className="text-xl font-semibold text-red-900 mb-2">
                User Not Found in System
              </h2>
              <p className="text-red-700">
                User code <span className="font-mono font-bold">{userCode}</span> is not registered in the NFPC hierarchy system.
              </p>
            </div>
            
            <div className="space-y-4 mb-8">
              <div className="flex items-start space-x-3">
                <div className="bg-orange-100 p-2 rounded-full mt-1">
                  <AlertTriangle className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Why am I seeing this?</h3>
                  <p className="text-gray-600 text-sm mt-1">
                    Your user account is not found in our system database. This could be because:
                  </p>
                  <ul className="list-disc list-inside text-gray-600 text-sm mt-2 ml-4 space-y-1">
                    <li>Your account has not been created yet</li>
                    <li>Your user code was entered incorrectly</li>
                    <li>Your account has been deactivated</li>
                    <li>You don&apos;t have the required permissions</li>
                  </ul>
                </div>
              </div>
            </div>
            
            {/* Contact Section */}
            <div className="bg-gray-50 rounded-lg p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Need Help?</h3>
              <p className="text-gray-600 text-sm">
                Please contact your system administrator for assistance.
              </p>
            </div>
          </div>
          
          {/* Footer */}
          <div className="bg-gray-50 px-8 py-4 border-t">
            <p className="text-xs text-gray-500 text-center">
              Contact your system administrator for assistance.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function UserNotFoundPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <UserNotFoundContent />
    </Suspense>
  )
}
