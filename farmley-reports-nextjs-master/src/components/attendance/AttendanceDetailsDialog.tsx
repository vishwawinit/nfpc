'use client'

import React from 'react'
import { X, Calendar, Clock, MapPin, AlertCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

interface AttendanceDetail {
  attendanceDate: string
  attendanceStatus: string
  leaveType: string | null
  holidayName: string | null
  journeyStartTime: string | null
  journeyEndTime: string | null
  totalWorkingMinutes: number
  startLatitude: number | null
  startLongitude: number | null
  remarks: string | null
  reason: string | null
}

interface AttendanceDetailsDialogProps {
  isOpen: boolean
  onClose: () => void
  userName: string
  userCode: string
  userRole: string
  details: AttendanceDetail[]
  loading: boolean
}

export const AttendanceDetailsDialog: React.FC<AttendanceDetailsDialogProps> = ({
  isOpen,
  onClose,
  userName,
  userCode,
  userRole,
  details,
  loading
}) => {
  if (!isOpen) return null

  const formatTime = (dateTime: string | null) => {
    if (!dateTime) return '-'
    try {
      const date = new Date(dateTime)
      if (isNaN(date.getTime()) || date.getFullYear() < 2000) return '-'
      return date.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true 
      })
    } catch {
      return '-'
    }
  }

  const formatMinutesToHours = (minutes: number) => {
    if (!minutes || minutes <= 0) return '-'
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return `${hours}h ${mins}m`
  }

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString)
      return date.toLocaleDateString('en-US', { 
        weekday: 'short',
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      })
    } catch {
      return dateString
    }
  }

  const getStatusBadge = (status: string, leaveType?: string | null, holidayName?: string | null) => {
    if (holidayName) {
      return <Badge className="bg-purple-600 hover:bg-purple-700">Holiday</Badge>
    }
    if (leaveType) {
      return <Badge className="bg-orange-600 hover:bg-orange-700">Leave</Badge>
    }
    
    switch(status) {
      case 'Present':
        return <Badge className="bg-emerald-600 hover:bg-emerald-700">Present</Badge>
      case 'Absent':
        return <Badge variant="destructive">Absent</Badge>
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }

  // Calculate summary stats
  const summary = {
    total: details.length,
    present: details.filter(d => d.attendanceStatus === 'Present').length,
    absent: details.filter(d => d.attendanceStatus === 'Absent').length,
    leave: details.filter(d => d.leaveType).length,
    holiday: details.filter(d => d.holidayName).length,
    totalHours: Math.round(details.reduce((sum, d) => sum + (d.totalWorkingMinutes || 0), 0) / 60)
  }

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 z-40"
        onClick={onClose}
      />
      
      {/* Dialog */}
      <div className="fixed inset-4 md:inset-10 lg:inset-20 bg-white rounded-lg shadow-2xl z-50 flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-xl font-semibold text-gray-800">
                Day-wise Attendance Details
              </h2>
              <div className="mt-2 space-y-1">
                <p className="text-sm text-gray-600">
                  <span className="font-medium">User:</span> {userName} ({userCode})
                </p>
                <p className="text-sm text-gray-600">
                  <span className="font-medium">Role:</span> {userRole}
                </p>
                <p className="text-sm text-gray-600">
                  <span className="font-medium">Period:</span> Showing {summary.total} days of attendance records
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mt-4">
            <div className="bg-gray-50 px-3 py-2 rounded">
              <div className="text-xs text-gray-500">Total Days</div>
              <div className="text-lg font-semibold">{summary.total}</div>
            </div>
            <div className="bg-emerald-50 px-3 py-2 rounded">
              <div className="text-xs text-emerald-600">Present</div>
              <div className="text-lg font-semibold text-emerald-700">{summary.present}</div>
            </div>
            <div className="bg-red-50 px-3 py-2 rounded">
              <div className="text-xs text-red-600">Absent</div>
              <div className="text-lg font-semibold text-red-700">{summary.absent}</div>
            </div>
            <div className="bg-orange-50 px-3 py-2 rounded">
              <div className="text-xs text-orange-600">Leave</div>
              <div className="text-lg font-semibold text-orange-700">{summary.leave}</div>
            </div>
            <div className="bg-purple-50 px-3 py-2 rounded">
              <div className="text-xs text-purple-600">Holiday</div>
              <div className="text-lg font-semibold text-purple-700">{summary.holiday}</div>
            </div>
            <div className="bg-blue-50 px-3 py-2 rounded">
              <div className="text-xs text-blue-600">Total Hours</div>
              <div className="text-lg font-semibold text-blue-700">{summary.totalHours}h</div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-gray-500">Loading attendance details...</div>
            </div>
          ) : details.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full">
              <AlertCircle className="h-12 w-12 text-gray-400 mb-3" />
              <p className="text-gray-500">No attendance records found for this user</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b-2 border-gray-200">
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                      <Calendar className="w-4 h-4 inline mr-1" />
                      Date
                    </th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Status</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">
                      <Clock className="w-4 h-4 inline mr-1" />
                      Journey Start
                    </th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">
                      <Clock className="w-4 h-4 inline mr-1" />
                      Journey End
                    </th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Working Hours</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">
                      <MapPin className="w-4 h-4 inline mr-1" />
                      Location
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {details.map((detail, idx) => (
                    <tr key={idx} className="border-b border-gray-200 hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-800">
                          {formatDate(detail.attendanceDate)}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {getStatusBadge(detail.attendanceStatus, detail.leaveType, detail.holidayName)}
                        {detail.leaveType && (
                          <div className="text-xs text-gray-600 mt-1">{detail.leaveType}</div>
                        )}
                        {detail.holidayName && (
                          <div className="text-xs text-purple-600 mt-1">{detail.holidayName}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center text-sm">
                        {formatTime(detail.journeyStartTime)}
                      </td>
                      <td className="px-4 py-3 text-center text-sm">
                        {formatTime(detail.journeyEndTime)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`font-semibold ${
                          detail.totalWorkingMinutes >= 480 ? 'text-emerald-700' :
                          detail.totalWorkingMinutes >= 240 ? 'text-amber-600' :
                          detail.totalWorkingMinutes > 0 ? 'text-orange-600' : 'text-gray-400'
                        }`}>
                          {formatMinutesToHours(detail.totalWorkingMinutes)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-sm">
                        {detail.startLatitude && detail.startLongitude ? (
                          <a
                            href={`https://www.google.com/maps?q=${detail.startLatitude},${detail.startLongitude}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 hover:underline inline-flex items-center gap-1"
                          >
                            <MapPin className="h-3 w-3" />
                            View
                          </a>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {detail.remarks || detail.reason || (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
