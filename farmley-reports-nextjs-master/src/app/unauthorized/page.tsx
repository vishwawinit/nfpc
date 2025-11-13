'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { AlertCircle, Lock } from 'lucide-react'

function UnauthorizedPageContent() {
  const searchParams = useSearchParams()
  const attemptedPath = searchParams.get('from')

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-lg shadow-xl p-8">
          {/* Icon and Title */}
          <div className="flex flex-col items-center mb-6">
            <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mb-4">
              <Lock className="w-10 h-10 text-red-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 text-center">
              Unauthorized Access
            </h1>
            <p className="text-gray-500 mt-2 text-center">
              Security Verification Failed
            </p>
          </div>

          {/* Error Message */}
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="flex items-start">
              <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 mr-2 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm text-red-800 font-medium mb-1">
                  Access Denied
                </p>
                <p className="text-sm text-red-700">
                  You must access this application through the main website. Direct access is not permitted for security reasons.
                </p>
              </div>
            </div>
          </div>

          {/* Info Section */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <h3 className="text-sm font-semibold text-blue-900 mb-2">
              How to access this application:
            </h3>
            <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
              <li>Go to the main website</li>
              <li>Log in with your credentials</li>
              <li>Navigate to the Reports section</li>
              <li>Click on the Reports Dashboard link</li>
            </ol>
          </div>

          {/* Attempted Path Info */}
          {attemptedPath && (
            <div className="bg-gray-50 rounded-lg p-3 mb-6">
              <p className="text-xs text-gray-500">
                Attempted to access: <code className="text-xs bg-gray-200 px-1 py-0.5 rounded">{attemptedPath}</code>
              </p>
            </div>
          )}

          {/* Security Notice */}
          <div className="mt-6 pt-6 border-t border-gray-200">
            <p className="text-xs text-gray-500 text-center">
              This security measure helps protect your data and ensures that only authorized users can access the reporting system.
            </p>
          </div>
        </div>

        {/* Additional Help Text */}
        <p className="text-center text-sm text-gray-600 mt-6">
          Need help? Contact your system administrator or IT support team.
        </p>
      </div>
    </div>
  )
}

export default function UnauthorizedPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <UnauthorizedPageContent />
    </Suspense>
  )
}
