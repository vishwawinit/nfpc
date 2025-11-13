import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-IN').format(num)
}

export function formatCurrency(amount: number, currencyCode: string = 'INR'): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount)
}

export function formatPercentage(value: number): string {
  return `${value.toFixed(1)}%`
}

// Branding / assets helpers
export function getAssetBaseUrl(): string {
  // Prefer client-side var if present, fallback to server var, then NFPC default
  return process.env.NEXT_PUBLIC_ASSET_BASE_URL || process.env.ASSET_BASE_URL || 'https://nfpcsfalive.winitsoftware.com/'
}
