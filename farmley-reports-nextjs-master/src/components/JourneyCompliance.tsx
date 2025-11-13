import React, { useState, useEffect } from 'react'
import { colors } from '../styles/colors'
import { useResponsive } from '@/hooks/useResponsive'
import { Download } from 'lucide-react'
import ExcelJS from 'exceljs'

interface JourneyComplianceProps {
  salesmen: any[]
  selectedSalesman: string
  date: string
  selectedRoute?: string
  searchQuery?: string
  onSalesmanSelect?: (salesman: any) => void
}

export const JourneyCompliance: React.FC<JourneyComplianceProps> = ({
  salesmen,
  selectedSalesman,
  date,
  selectedRoute = 'all',
  searchQuery = '',
  onSalesmanSelect
}) => {
  const { isMobile, styles } = useResponsive()
  const [complianceData, setComplianceData] = useState<any[]>([])
  const [summary, setSummary] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [filteredData, setFilteredData] = useState<any[]>([])

  useEffect(() => {
    fetchJourneyCompliance()
  }, [date, selectedSalesman, selectedRoute])

  // Apply search filter
  useEffect(() => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      const filtered = complianceData.filter(journey =>
        journey.userName?.toLowerCase().includes(query) ||
        journey.userCode?.toLowerCase().includes(query) ||
        journey.routeCode?.toLowerCase().includes(query) ||
        journey.routeName?.toLowerCase().includes(query)
      )
      setFilteredData(filtered)
    } else {
      setFilteredData(complianceData)
    }
  }, [searchQuery, complianceData])

  const fetchJourneyCompliance = async () => {
    setLoading(true)
    try {
      // Build API URL with all filter parameters
      const params = new URLSearchParams({ date, salesmanCode: selectedSalesman })
      if (selectedRoute !== 'all') params.append('route', selectedRoute)

      const response = await fetch(
        `/api/field-operations/journey-compliance?${params.toString()}`
      )
      if (response.ok) {
        const data = await response.json()
        const complianceList = data.compliance || []
        setComplianceData(complianceList)
        setFilteredData(complianceList) // Initialize filtered data
        setSummary(data.summary)
      }
    } catch (error) {
      console.error('Error fetching journey compliance:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch(status?.toLowerCase()) {
      case 'completed': return colors.success.main
      case 'in progress': return colors.warning.main
      case 'not started': return colors.gray[400]
      default: return colors.gray[600]
    }
  }

  const formatTime = (timeString: string) => {
    if (!timeString) return '--:--'
    try {
      // Handle different time formats - convert to 12-hour AM/PM format in UAE timezone
      if (timeString.includes('T')) {
        // ISO datetime format like "2025-09-04T08:57:38"
        const time = new Date(timeString)
        return time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Dubai' })
      } else if (timeString.includes(' ') && timeString.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/)) {
        // SQL datetime format like "2025-09-04 08:57:38"
        const time = new Date(timeString)
        return time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Dubai' })
      } else if (timeString.match(/^\d{2}:\d{2}:\d{2}/)) {
        // HH:MM:SS format - convert to 12-hour AM/PM
        const [hours, minutes] = timeString.split(':')
        const hour = parseInt(hours)
        const ampm = hour >= 12 ? 'PM' : 'AM'
        const hour12 = hour % 12 || 12
        return `${hour12}:${minutes} ${ampm}`
      } else if (timeString.match(/^\d{2}:\d{2}/)) {
        // HH:MM format - convert to 12-hour AM/PM
        const [hours, minutes] = timeString.split(':')
        const hour = parseInt(hours)
        const ampm = hour >= 12 ? 'PM' : 'AM'
        const hour12 = hour % 12 || 12
        return `${hour12}:${minutes} ${ampm}`
      } else {
        // Try to parse with date prefix for pure time strings
        const time = new Date(`2024-01-01 ${timeString}`)
        if (isNaN(time.getTime())) {
          return '--:--'
        }
        return time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Dubai' })
      }
    } catch {
      return '--:--'
    }
  }

  const exportToExcel = async () => {
    if (!filteredData || filteredData.length === 0) {
      alert('No data available to export')
      return
    }

    try {
      const workbook = new ExcelJS.Workbook()
      const worksheet = workbook.addWorksheet('Journey Compliance Report')

      // Set column widths
      worksheet.columns = [
        { width: 25 }, // Salesman
        { width: 30 }, // Route
        { width: 20 }, // Journey Time
        { width: 12 }, // Planned
        { width: 12 }, // Visited
        { width: 12 }, // Productive
        { width: 18 }, // Sales
        { width: 18 }  // Journey Status
      ]

      let currentRow = 1

      // Title
      worksheet.mergeCells(`A${currentRow}:H${currentRow}`)
      const titleCell = worksheet.getCell(`A${currentRow}`)
      titleCell.value = 'Journey Compliance Report'
      titleCell.font = { size: 18, bold: true, color: { argb: 'FF1E40AF' } }
      titleCell.alignment = { horizontal: 'center', vertical: 'middle' }
      titleCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E7FF' }
      }
      worksheet.getRow(currentRow).height = 30
      currentRow++

      // Date header
      worksheet.mergeCells(`A${currentRow}:H${currentRow}`)
      const dateCell = worksheet.getCell(`A${currentRow}`)
      dateCell.value = `Date: ${new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}`
      dateCell.font = { size: 12, bold: true }
      dateCell.alignment = { horizontal: 'center', vertical: 'middle' }
      dateCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF3F4F6' }
      }
      worksheet.getRow(currentRow).height = 25
      currentRow++

      // Empty row
      currentRow++

      // Summary Section Title
      worksheet.mergeCells(`A${currentRow}:H${currentRow}`)
      const summaryTitleCell = worksheet.getCell(`A${currentRow}`)
      summaryTitleCell.value = 'Summary Statistics'
      summaryTitleCell.font = { size: 14, bold: true, color: { argb: 'FF1F2937' } }
      summaryTitleCell.alignment = { horizontal: 'left', vertical: 'middle' }
      summaryTitleCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFDBEAFE' }
      }
      worksheet.getRow(currentRow).height = 25
      currentRow++

      // Summary stats (2 rows of data)
      if (summary) {
        // First row of summary
        worksheet.getCell(`A${currentRow}`).value = 'Total Salesmen'
        worksheet.getCell(`A${currentRow}`).font = { bold: true }
        worksheet.getCell(`A${currentRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } }
        worksheet.getCell(`B${currentRow}`).value = summary.totalSalesmen
        worksheet.getCell(`B${currentRow}`).font = { bold: true, size: 12 }
        worksheet.getCell(`B${currentRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } }

        worksheet.getCell(`C${currentRow}`).value = 'Planned Visits'
        worksheet.getCell(`C${currentRow}`).font = { bold: true }
        worksheet.getCell(`C${currentRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } }
        worksheet.getCell(`D${currentRow}`).value = summary.totalPlanned
        worksheet.getCell(`D${currentRow}`).font = { bold: true, size: 12 }
        worksheet.getCell(`D${currentRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } }

        worksheet.getCell(`E${currentRow}`).value = 'Completed Visits'
        worksheet.getCell(`E${currentRow}`).font = { bold: true }
        worksheet.getCell(`E${currentRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } }
        worksheet.getCell(`F${currentRow}`).value = summary.totalVisited
        worksheet.getCell(`F${currentRow}`).font = { bold: true, size: 12, color: { argb: 'FF059669' } }
        worksheet.getCell(`F${currentRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } }

        worksheet.getRow(currentRow).height = 20
        currentRow++

        // Second row of summary
        worksheet.getCell(`A${currentRow}`).value = 'Productive Visits'
        worksheet.getCell(`A${currentRow}`).font = { bold: true }
        worksheet.getCell(`A${currentRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } }
        worksheet.getCell(`B${currentRow}`).value = summary.productiveVisits || 0
        worksheet.getCell(`B${currentRow}`).font = { bold: true, size: 12, color: { argb: 'FF059669' } }
        worksheet.getCell(`B${currentRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } }

        worksheet.getCell(`C${currentRow}`).value = 'Total Sales'
        worksheet.getCell(`C${currentRow}`).font = { bold: true }
        worksheet.getCell(`C${currentRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } }
        worksheet.getCell(`D${currentRow}`).value = summary.totalDailySales ? `AED ${Math.round(summary.totalDailySales).toLocaleString()}` : 'AED 0'
        worksheet.getCell(`D${currentRow}`).font = { bold: true, size: 12, color: { argb: 'FF2563EB' } }
        worksheet.getCell(`D${currentRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } }

        worksheet.getRow(currentRow).height = 20
        currentRow++
      }

      // Empty rows
      currentRow++
      currentRow++

      // Table Header
      const headerRow = worksheet.getRow(currentRow)
      headerRow.values = [
        'Salesman',
        'Route',
        'Journey Time',
        'Planned',
        'Visited',
        'Productive',
        'Sales',
        'Journey Status'
      ]
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 }
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1E40AF' }
      }
      headerRow.alignment = { horizontal: 'center', vertical: 'middle' }
      headerRow.height = 25

      // Add borders to header
      headerRow.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin', color: { argb: 'FF9CA3AF' } },
          left: { style: 'thin', color: { argb: 'FF9CA3AF' } },
          bottom: { style: 'thin', color: { argb: 'FF9CA3AF' } },
          right: { style: 'thin', color: { argb: 'FF9CA3AF' } }
        }
      })
      currentRow++

      // Data rows
      filteredData.forEach((journey, index) => {
        const row = worksheet.getRow(currentRow)
        row.values = [
          journey.userName,
          journey.routeCode && journey.routeCode !== journey.routeName ?
            `${journey.routeCode} - ${journey.routeName}` :
            journey.routeName,
          `${formatTime(journey.startTime)} - ${formatTime(journey.endTime)}`,
          journey.plannedVisits,
          journey.completedVisits,
          journey.productiveVisits,
          `AED ${journey.totalSales.toLocaleString()}`,
          journey.journeyStatus || '--'
        ]

        // Alternating row colors
        const bgColor = index % 2 === 0 ? 'FFFFFFFF' : 'FFF9FAFB'
        row.eachCell((cell, colNumber) => {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: bgColor }
          }
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
            left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
            bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
            right: { style: 'thin', color: { argb: 'FFE5E7EB' } }
          }
          cell.alignment = { vertical: 'middle' }

          // Center align numeric columns
          if (colNumber >= 4 && colNumber <= 8) {
            cell.alignment = { horizontal: 'center', vertical: 'middle' }
          }

          // Special formatting for productive visits (green)
          if (colNumber === 6) {
            cell.font = { color: { argb: 'FF059669' }, bold: true }
          }

          // Special formatting for sales (blue bold)
          if (colNumber === 7) {
            cell.font = { color: { argb: 'FF1E40AF' }, bold: true }
          }

          // Journey Status badge-like formatting
          if (colNumber === 8) {
            const status = journey.journeyStatus?.toLowerCase()
            if (status === 'completed') {
              cell.font = { color: { argb: 'FF059669' }, bold: true }
              cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFD1FAE5' }
              }
            } else if (status === 'in progress') {
              cell.font = { color: { argb: 'FFD97706' }, bold: true }
              cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFFEF3C7' }
              }
            }
          }
        })

        row.height = 20
        currentRow++
      })

      // Add footer with totals
      currentRow++
      const footerRow = worksheet.getRow(currentRow)
      footerRow.values = [
        'TOTAL',
        '',
        '',
        filteredData.reduce((sum, j) => sum + (j.plannedVisits || 0), 0),
        filteredData.reduce((sum, j) => sum + (j.completedVisits || 0), 0),
        filteredData.reduce((sum, j) => sum + (j.productiveVisits || 0), 0),
        `AED ${filteredData.reduce((sum, j) => sum + (j.totalSales || 0), 0).toLocaleString()}`,
        ''
      ]
      footerRow.font = { bold: true, size: 11 }
      footerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFDBEAFE' }
      }
      footerRow.eachCell((cell, colNumber) => {
        cell.border = {
          top: { style: 'medium', color: { argb: 'FF6B7280' } },
          left: { style: 'thin', color: { argb: 'FF9CA3AF' } },
          bottom: { style: 'medium', color: { argb: 'FF6B7280' } },
          right: { style: 'thin', color: { argb: 'FF9CA3AF' } }
        }
        if (colNumber >= 4) {
          cell.alignment = { horizontal: 'center', vertical: 'middle' }
        }
      })
      footerRow.height = 25

      // Generate Excel file
      const buffer = await workbook.xlsx.writeBuffer()
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `Journey_Compliance_Report_${new Date(date).toLocaleDateString('en-GB').replace(/\//g, '-')}.xlsx`
      link.click()
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error exporting to Excel:', error)
      alert('Failed to export data. Please try again.')
    }
  }

  if (loading) {
    return (
      <div style={{ ...styles.padding('40px', '20px'), textAlign: 'center', color: colors.gray[500] }}>
        Loading journey compliance data...
      </div>
    )
  }

  return (
    <div>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: isMobile ? '16px' : '20px'
      }}>
        <h3 style={{ ...styles.heading('18px', '16px'), margin: 0, color: colors.gray[900] }}>
          Journey Compliance Report
        </h3>
        <button
          onClick={exportToExcel}
          disabled={!filteredData || filteredData.length === 0}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: isMobile ? '8px 12px' : '10px 16px',
            backgroundColor: colors.success.main,
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: isMobile ? '12px' : '14px',
            fontWeight: '600',
            cursor: filteredData && filteredData.length > 0 ? 'pointer' : 'not-allowed',
            opacity: filteredData && filteredData.length > 0 ? 1 : 0.5,
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            if (filteredData && filteredData.length > 0) {
              e.currentTarget.style.backgroundColor = '#047857'
            }
          }}
          onMouseLeave={(e) => {
            if (filteredData && filteredData.length > 0) {
              e.currentTarget.style.backgroundColor = colors.success.main
            }
          }}
        >
          <Download size={isMobile ? 14 : 16} />
          Export Excel
        </button>
      </div>

      {/* Summary Stats */}
      {summary && (
        <div style={{
          ...styles.gridTemplate(5, 2),
          marginBottom: isMobile ? '16px' : '24px'
        }}>
          <div style={{
            ...styles.cardPadding(),
            borderRadius: '8px',
            backgroundColor: colors.background.secondary,
            border: `1px solid ${colors.gray[200]}`
          }}>
            <div style={{ ...styles.fontSize('24px', '20px'), fontWeight: '700', color: colors.gray[900] }}>
              {summary.totalSalesmen}
            </div>
            <div style={{ ...styles.fontSize('12px', '11px'), color: colors.gray[500] }}>Total Salesmen</div>
          </div>
          <div style={{
            ...styles.cardPadding(),
            borderRadius: '8px',
            backgroundColor: colors.background.secondary,
            border: `1px solid ${colors.gray[200]}`
          }}>
            <div style={{ ...styles.fontSize('24px', '20px'), fontWeight: '700', color: colors.primary[500] }}>
              {summary.totalPlanned}
            </div>
            <div style={{ ...styles.fontSize('12px', '11px'), color: colors.gray[500] }}>Planned Visits</div>
          </div>
          <div style={{
            ...styles.cardPadding(),
            borderRadius: '8px',
            backgroundColor: colors.background.secondary,
            border: `1px solid ${colors.gray[200]}`
          }}>
            <div style={{ ...styles.fontSize('24px', '20px'), fontWeight: '700', color: colors.success.main }}>
              {summary.totalVisited}
            </div>
            <div style={{ ...styles.fontSize('12px', '11px'), color: colors.gray[500] }}>Completed Visits</div>
          </div>
          <div style={{
            ...styles.cardPadding(),
            borderRadius: '8px',
            backgroundColor: colors.background.secondary,
            border: `1px solid ${colors.gray[200]}`
          }}>
            <div style={{ ...styles.fontSize('24px', '20px'), fontWeight: '700', color: colors.success.main }}>
              {summary.productiveVisits || 0}
            </div>
            <div style={{ ...styles.fontSize('12px', '11px'), color: colors.gray[500] }}>Productive Visits</div>
          </div>
          <div style={{
            ...styles.cardPadding(),
            borderRadius: '8px',
            backgroundColor: colors.background.secondary,
            border: `1px solid ${colors.gray[200]}`
          }}>
            <div style={{ ...styles.fontSize('24px', '18px'), fontWeight: '700', color: colors.primary[500] }}>
              {summary.totalDailySales ? `AED ${Math.round(summary.totalDailySales).toLocaleString()}` : 'AED 0'}
            </div>
            <div style={{ ...styles.fontSize('12px', '11px'), color: colors.gray[500] }}>Total Sales</div>
          </div>
        </div>
      )}

      {/* Compliance Table */}
      <div style={{
        backgroundColor: colors.background.secondary,
        borderRadius: '8px',
        ...styles.padding('20px', '12px'),
        border: `1px solid ${colors.gray[200]}`,
        ...styles.overflow('auto', 'auto')
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', ...(isMobile && { minWidth: '600px' }) }}>
          <thead>
            <tr style={{ borderBottom: `2px solid ${colors.gray[200]}` }}>
              <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: colors.gray[600] }}>
                Salesman
              </th>
              <th style={{ padding: '12px', textAlign: 'left', fontSize: '12px', fontWeight: '600', color: colors.gray[600] }}>
                Route
              </th>
              <th style={{ padding: '12px', textAlign: 'center', fontSize: '12px', fontWeight: '600', color: colors.gray[600] }}>
                Journey Time
              </th>
              <th style={{ padding: '12px', textAlign: 'center', fontSize: '12px', fontWeight: '600', color: colors.gray[600] }}>
                Planned
              </th>
              <th style={{ padding: '12px', textAlign: 'center', fontSize: '12px', fontWeight: '600', color: colors.gray[600] }}>
                Visited
              </th>
              <th style={{ padding: '12px', textAlign: 'center', fontSize: '12px', fontWeight: '600', color: colors.gray[600] }}>
                Productive
              </th>
              <th style={{ padding: '12px', textAlign: 'center', fontSize: '12px', fontWeight: '600', color: colors.gray[600] }}>
                Sales
              </th>
              <th style={{ padding: '12px', textAlign: 'center', fontSize: '12px', fontWeight: '600', color: colors.gray[600] }}>
                Journey Status
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredData.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ padding: '24px', textAlign: 'center', color: colors.gray[500] }}>
                  No journey data available for the selected date
                </td>
              </tr>
            ) : (
              filteredData.map((journey, index) => (
                <tr
                  key={`${journey.userCode}-${index}`}
                  onClick={() => onSalesmanSelect?.({
                    userCode: journey.userCode,
                    salesmanId: journey.userCode,
                    salesmanName: journey.userName,
                    name: journey.userName,
                    routeName: journey.routeName,
                    routeCode: journey.routeCode || journey.userCode,
                    journeyStatus: journey.journeyStatus
                  })}
                  style={{
                    borderBottom: `1px solid ${colors.gray[100]}`,
                    cursor: onSalesmanSelect ? 'pointer' : 'default',
                    transition: 'background-color 0.2s ease',
                    ':hover': onSalesmanSelect ? {
                      backgroundColor: colors.gray[50]
                    } : undefined
                  }}
                  onMouseEnter={(e) => {
                    if (onSalesmanSelect) {
                      e.currentTarget.style.backgroundColor = colors.gray[50]
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (onSalesmanSelect) {
                      e.currentTarget.style.backgroundColor = 'transparent'
                    }
                  }}
                >
                  <td style={{ padding: '12px', fontSize: '13px', color: colors.gray[800], fontWeight: '500' }}>
                    {journey.userName}
                  </td>
                  <td style={{ padding: '12px', fontSize: '13px', color: colors.gray[600] }}>
                    {journey.routeCode && journey.routeCode !== journey.routeName ?
                      `${journey.routeCode} - ${journey.routeName}` :
                      journey.routeName
                    }
                  </td>
                  <td style={{ padding: '12px', fontSize: '13px', color: colors.gray[600], textAlign: 'center' }}>
                    {formatTime(journey.startTime)} - {formatTime(journey.endTime)}
                  </td>
                  <td style={{ padding: '12px', fontSize: '13px', color: colors.gray[800], fontWeight: '600', textAlign: 'center' }}>
                    {journey.plannedVisits}
                  </td>
                  <td style={{ padding: '12px', fontSize: '13px', color: colors.gray[800], fontWeight: '600', textAlign: 'center' }}>
                    {journey.completedVisits}
                  </td>
                  <td style={{ padding: '12px', fontSize: '13px', color: colors.success.main, fontWeight: '600', textAlign: 'center' }}>
                    {journey.productiveVisits}
                  </td>
                  <td style={{ padding: '12px', fontSize: '13px', color: colors.gray[800], fontWeight: '600', textAlign: 'center' }}>
                    AED {journey.totalSales.toLocaleString()}
                  </td>
                  <td style={{ padding: '12px', textAlign: 'center' }}>
                    <span style={{
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontWeight: '500',
                      backgroundColor: journey.journeyStatus === 'completed' ? colors.success.light :
                                     journey.journeyStatus === 'in progress' ? colors.warning.light :
                                     colors.gray[100],
                      color: journey.journeyStatus === 'completed' ? colors.success.dark :
                             journey.journeyStatus === 'in progress' ? colors.warning.dark :
                             colors.gray[600],
                      textTransform: 'capitalize'
                    }}>
                      {journey.journeyStatus || '--'}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}