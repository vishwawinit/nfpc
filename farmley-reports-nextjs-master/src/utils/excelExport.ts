/**
 * Enhanced Excel Export Utility
 * Exports data with metadata, filters, and proper formatting
 */

interface FilterInfo {
  name: string
  value: string
}

interface ExportMetadata {
  reportName: string
  exportDate: string
  appliedFilters: FilterInfo[]
  totalRows: number
  additionalInfo?: Record<string, string | number>
}

export function exportToExcel(
  headers: string[],
  rows: (string | number)[][],
  metadata: ExportMetadata,
  filename: string
) {
  // Prepare metadata section
  const metadataLines: string[] = []
  metadataLines.push(`"Report Name:","${metadata.reportName}"`)
  metadataLines.push(`"Export Date:","${metadata.exportDate}"`)
  metadataLines.push(`"Total Rows:","${metadata.totalRows}"`)
  metadataLines.push('') // Empty line

  // Add applied filters
  if (metadata.appliedFilters.length > 0) {
    metadataLines.push(`"Applied Filters:"`)
    metadata.appliedFilters.forEach(filter => {
      metadataLines.push(`"${filter.name}:","${filter.value}"`)
    })
    metadataLines.push('') // Empty line
  }

  // Add additional info if provided
  if (metadata.additionalInfo) {
    Object.entries(metadata.additionalInfo).forEach(([key, value]) => {
      metadataLines.push(`"${key}:","${value}"`)
    })
    metadataLines.push('') // Empty line
  }

  // Add data section header
  metadataLines.push(`"Data Section:"`)
  metadataLines.push('') // Empty line

  // Prepare CSV content
  const csvContent = [
    ...metadataLines,
    headers.map(h => `"${h}"`).join(','),
    ...rows.map(row =>
      row.map(cell => {
        // Handle different data types
        if (cell === null || cell === undefined) {
          return '""'
        }
        // Convert to string and escape quotes
        const str = String(cell).replace(/"/g, '""')
        return `"${str}"`
      }).join(',')
    )
  ].join('\n')

  // Create and download file
  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.URL.revokeObjectURL(url)
}

// Helper function to format date for display
export function formatExportDate(): string {
  const now = new Date()
  return now.toLocaleString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

// Helper to collect filter information
export function collectFilterInfo(filters: Record<string, string | undefined>): FilterInfo[] {
  const filterInfo: FilterInfo[] = []

  Object.entries(filters).forEach(([key, value]) => {
    if (value && value !== '') {
      // Convert camelCase to Title Case
      const name = key
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, str => str.toUpperCase())
        .trim()

      filterInfo.push({ name, value })
    }
  })

  return filterInfo
}
