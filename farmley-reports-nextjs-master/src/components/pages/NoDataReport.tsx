'use client'

import { Database, LucideIcon } from 'lucide-react'

interface NoDataReportProps {
  title: string
  description: string
  icon?: LucideIcon
  tableName: string
  expectedFields?: string[]
}

export function NoDataReport({ title, description, icon: Icon, tableName, expectedFields }: NoDataReportProps) {
  const IconComponent = Icon || Database

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-800">{title}</h1>
        <p className="text-gray-600 mt-1">{description}</p>
      </div>

      {/* No Data Message */}
      <div className="bg-white rounded-lg shadow p-8">
        <div className="flex flex-col items-center justify-center text-center space-y-4">
          <div className="bg-gray-50 rounded-full p-4">
            <IconComponent className="text-gray-400" size={48} />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-800">
              No Data Available
            </h2>
            <p className="text-gray-600 mt-2 max-w-2xl">
              The data table <code className="bg-gray-100 px-2 py-1 rounded text-sm">{tableName}</code> is currently empty.
              No records have been loaded yet.
            </p>
          </div>
          {expectedFields && expectedFields.length > 0 && (
            <div className="bg-gray-50 rounded-lg p-6 max-w-2xl text-left w-full">
              <h3 className="font-semibold text-gray-800 mb-3">Expected data fields:</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {expectedFields.map((field, index) => (
                  <div key={index} className="text-sm text-gray-600 flex items-center gap-2">
                    <span className="w-2 h-2 bg-blue-400 rounded-full"></span>
                    <code className="text-xs">{field}</code>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800 max-w-2xl">
            <p className="font-medium mb-1">To populate this report:</p>
            <p>
              Load data into the <code className="font-mono">{tableName}</code> table through your data pipeline
              or ETL process. Once data is available, this report will automatically display the information.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
