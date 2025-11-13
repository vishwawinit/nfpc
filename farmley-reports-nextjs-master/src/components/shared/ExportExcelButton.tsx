'use client'

import React from 'react'
import { Button } from '@/components/ui/button'
import { Download, Loader2 } from 'lucide-react'

interface ExportExcelButtonProps {
  onClick: () => void | Promise<void>
  loading?: boolean
  label?: string
  variant?: 'default' | 'outline' | 'ghost'
  className?: string
  mobileFloating?: boolean
}

export const ExportExcelButton: React.FC<ExportExcelButtonProps> = ({
  onClick,
  loading = false,
  label = 'Export Excel',
  variant = 'default',
  className = '',
  mobileFloating = false
}) => {
  const [isLoading, setIsLoading] = React.useState(false)

  const handleClick = async () => {
    setIsLoading(true)
    try {
      await onClick()
    } finally {
      setIsLoading(false)
    }
  }

  const isProcessing = loading || isLoading

  if (mobileFloating) {
    return (
      <>
        {/* Desktop version */}
        <Button
          onClick={handleClick}
          disabled={isProcessing}
          variant={variant}
          className={`hidden md:inline-flex bg-emerald-600 hover:bg-emerald-700 text-white ${className}`}
        >
          {isProcessing ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Download className="h-4 w-4 mr-2" />
          )}
          <span>{label}</span>
        </Button>

        {/* Mobile floating button */}
        <Button
          onClick={handleClick}
          disabled={isProcessing}
          className="md:hidden fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg bg-emerald-600 hover:bg-emerald-700 text-white z-50"
          size="icon"
        >
          {isProcessing ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Download className="h-5 w-5" />
          )}
        </Button>
      </>
    )
  }

  return (
    <Button
      onClick={handleClick}
      disabled={isProcessing}
      variant={variant}
      className={`bg-emerald-600 hover:bg-emerald-700 text-white ${className}`}
    >
      {isProcessing ? (
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
      ) : (
        <Download className="h-4 w-4 mr-2" />
      )}
      <span className="hidden sm:inline">{label}</span>
      <span className="sm:hidden">Export</span>
    </Button>
  )
}
