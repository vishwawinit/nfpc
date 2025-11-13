'use client'

import React, { useState } from 'react'
import Image from 'next/image'
import { X, ZoomIn } from 'lucide-react'

interface ImageViewerProps {
  src: string
  alt?: string
  className?: string
  thumbnailWidth?: number
  thumbnailHeight?: number
}

export const ImageViewer: React.FC<ImageViewerProps> = ({
  src,
  alt = 'Image',
  className = '',
  thumbnailWidth = 120,
  thumbnailHeight = 120
}) => {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className={`relative inline-block ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="group relative overflow-hidden rounded-md border border-gray-200 hover:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
      >
        <Image
          src={src}
          alt={alt}
          width={thumbnailWidth}
          height={thumbnailHeight}
          className="object-cover w-full h-full transition-transform duration-200 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <ZoomIn className="w-6 h-6 text-white" />
        </div>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setIsOpen(false)}>
          <div className="relative max-w-4xl w-full" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="absolute -top-12 right-0 text-white hover:text-indigo-200"
            >
              <X className="w-8 h-8" />
            </button>
            <div className="relative w-full h-full bg-white rounded-lg overflow-hidden shadow-xl">
              <Image
                src={src}
                alt={alt}
                width={1200}
                height={800}
                className="w-full h-auto object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
