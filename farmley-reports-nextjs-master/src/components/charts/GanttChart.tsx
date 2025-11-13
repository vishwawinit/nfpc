import React, { useMemo } from 'react'
import { businessColors } from '@/styles/businessColors'

interface GanttActivity {
  id: string
  name: string
  user: string
  startTime: Date
  endTime: Date
  status: 'completed' | 'in-progress' | 'pending' | 'delayed'
  completionPercent?: number
}

interface GanttChartProps {
  activities: GanttActivity[]
  height?: number
}

const statusColors = {
  completed: businessColors.success.main,
  'in-progress': businessColors.primary[500],
  pending: businessColors.warning.main,
  delayed: businessColors.error.main
}

export const GanttChart: React.FC<GanttChartProps> = ({ 
  activities,
  height = 400 
}) => {
  const { minTime, maxTime, users, timeRange } = useMemo(() => {
    const times = activities.flatMap(a => [a.startTime.getTime(), a.endTime.getTime()])
    const minT = new Date(Math.min(...times))
    const maxT = new Date(Math.max(...times))
    const userSet = new Set(activities.map(a => a.user))
    const range = maxT.getTime() - minT.getTime()
    
    return {
      minTime: minT,
      maxTime: maxT,
      users: Array.from(userSet),
      timeRange: range
    }
  }, [activities])

  const getPosition = (time: Date) => {
    return ((time.getTime() - minTime.getTime()) / timeRange) * 100
  }

  const getWidth = (start: Date, end: Date) => {
    return ((end.getTime() - start.getTime()) / timeRange) * 100
  }

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })
  }

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en', { month: 'short', day: 'numeric' })
  }

  // Generate time markers
  const timeMarkers = useMemo(() => {
    const markers = []
    const hourMs = 60 * 60 * 1000
    const startHour = Math.floor(minTime.getTime() / hourMs) * hourMs
    const endHour = Math.ceil(maxTime.getTime() / hourMs) * hourMs
    
    for (let time = startHour; time <= endHour; time += hourMs) {
      const date = new Date(time)
      markers.push({
        time: date,
        position: getPosition(date),
        label: formatTime(date)
      })
    }
    
    return markers
  }, [minTime, maxTime, timeRange])

  return (
    <div className="overflow-x-auto">
      <div style={{ minWidth: '800px', height: `${height}px` }} className="relative bg-white">
        {/* Timeline header */}
        <div className="h-12 border-b border-gray-300 flex items-center px-4 bg-gray-50">
          <div className="w-32 font-semibold text-sm text-gray-700">User</div>
          <div className="flex-1 relative">
            {timeMarkers.map((marker, idx) => (
              <div
                key={idx}
                className="absolute text-xs text-gray-600"
                style={{ left: `${marker.position}%` }}
              >
                {marker.label}
              </div>
            ))}
          </div>
        </div>

        {/* Gantt rows */}
        <div className="relative">
          {/* Time grid lines */}
          <div className="absolute inset-0 pointer-events-none">
            {timeMarkers.map((marker, idx) => (
              <div
                key={idx}
                className="absolute top-0 bottom-0 border-l border-gray-200"
                style={{ left: `calc(${marker.position}% + 128px)` }}
              />
            ))}
          </div>

          {/* Activity rows by user */}
          {users.map((user, userIdx) => {
            const userActivities = activities.filter(a => a.user === user)
            
            return (
              <div
                key={user}
                className="flex items-center border-b border-gray-200 hover:bg-gray-50"
                style={{ height: '60px' }}
              >
                <div className="w-32 px-4 text-sm font-medium text-gray-700 truncate" title={user}>
                  {user}
                </div>
                <div className="flex-1 relative px-4">
                  {userActivities.map((activity) => {
                    const left = getPosition(activity.startTime)
                    const width = getWidth(activity.startTime, activity.endTime)
                    const color = statusColors[activity.status]
                    
                    return (
                      <div
                        key={activity.id}
                        className="absolute top-1/2 -translate-y-1/2 h-8 rounded cursor-pointer hover:opacity-80 transition-opacity"
                        style={{
                          left: `${left}%`,
                          width: `${width}%`,
                          backgroundColor: color,
                          minWidth: '20px'
                        }}
                        title={`${activity.name}\n${formatTime(activity.startTime)} - ${formatTime(activity.endTime)}\nStatus: ${activity.status}`}
                      >
                        {/* Completion indicator */}
                        {activity.completionPercent !== undefined && activity.status === 'in-progress' && (
                          <div
                            className="h-full bg-white bg-opacity-50 rounded-l"
                            style={{ width: `${activity.completionPercent}%` }}
                          />
                        )}
                        
                        {/* Activity label */}
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-xs font-medium text-white truncate px-2">
                            {activity.name}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>

        {/* Legend */}
        <div className="mt-4 flex gap-4 px-4 pb-4">
          {Object.entries(statusColors).map(([status, color]) => (
            <div key={status} className="flex items-center gap-2">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: color }} />
              <span className="text-xs text-gray-600 capitalize">{status.replace('-', ' ')}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
