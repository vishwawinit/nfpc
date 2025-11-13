'use client'

import React from 'react'
import { Loader2 } from 'lucide-react'

interface LoadingBarProps {
  message?: string
}

export const LoadingBar: React.FC<LoadingBarProps> = ({ message = 'Loading...' }) => {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
      <p className="mt-4 text-sm text-gray-600">{message}</p>
    </div>
  )
}
