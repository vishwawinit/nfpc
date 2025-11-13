'use client'

import React, { useState } from 'react'
import { Info } from 'lucide-react'

interface InfoTooltipProps {
  content: string
}

export const InfoTooltip: React.FC<InfoTooltipProps> = ({ content }) => {
  const [showTooltip, setShowTooltip] = useState(false)

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onClick={() => setShowTooltip(!showTooltip)}
        className="text-gray-400 hover:text-gray-600 transition-colors focus:outline-none"
      >
        <Info className="w-4 h-4" />
      </button>
      
      {showTooltip && (
        <div className="absolute z-[99999] bottom-full left-1/2 -translate-x-1/2 mb-2 px-4 py-2 text-xs text-white bg-gray-900 rounded-md shadow-2xl max-w-sm w-max whitespace-normal leading-relaxed">
          {content}
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1">
            <div className="border-4 border-transparent border-t-gray-900" />
          </div>
        </div>
      )}
    </div>
  )
}
