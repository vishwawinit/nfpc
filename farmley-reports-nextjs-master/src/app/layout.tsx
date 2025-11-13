import './globals.css'
import { Inter } from 'next/font/google'
import { Metadata, Viewport } from 'next'
import { SecurityProvider } from '@/contexts/SecurityContext'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'NFPC Analytics - Sales and Business Intelligence Dashboard',
  description: 'Comprehensive sales analytics and business intelligence dashboard for NFPC',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5" />
      </head>
      <body className={inter.className}>
        <SecurityProvider>
          {children}
        </SecurityProvider>
      </body>
    </html>
  )
}