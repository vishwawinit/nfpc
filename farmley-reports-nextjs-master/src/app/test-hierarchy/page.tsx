'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function TestHierarchyPage() {
  const [userCode, setUserCode] = useState('TB0016')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  const testHierarchy = async () => {
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const response = await fetch(`/api/dashboard/test-hierarchy?userCode=${userCode}`)
      const data = await response.json()
      
      if (!response.ok) {
        setError(data.error || 'Failed to test hierarchy')
      } else {
        setResult(data)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const testDashboardFilters = async () => {
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const params = new URLSearchParams({
        loginUserCode: userCode,
        startDate: '2025-10-01',
        endDate: '2025-10-28'
      })
      
      const response = await fetch(`/api/dashboard/filters?${params}`)
      const data = await response.json()
      
      if (!response.ok || !data.success) {
        setError(data.error || 'Failed to fetch filters')
      } else {
        setResult({
          userCode,
          filterData: data.data,
          hierarchy: data.hierarchy
        })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Test User Hierarchy</h1>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Test User</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-4">
            <input
              type="text"
              value={userCode}
              onChange={(e) => setUserCode(e.target.value)}
              className="px-3 py-2 border rounded"
              placeholder="Enter user code"
            />
            <Button onClick={testHierarchy} disabled={loading}>
              Test Hierarchy
            </Button>
            <Button onClick={testDashboardFilters} disabled={loading} variant="outline">
              Test Dashboard Filters
            </Button>
          </div>

          <div className="space-y-2 mb-4">
            <p className="text-sm text-gray-600">Test with these user codes:</p>
            <div className="flex flex-wrap gap-2">
              {['TB0016', 'TB0500', 'TB0113', 'TB0704', 'TB1154', 'INVALID', 'admin'].map(code => (
                <button
                  key={code}
                  onClick={() => setUserCode(code)}
                  className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded"
                >
                  {code}
                </button>
              ))}
            </div>
          </div>

          {loading && <div>Loading...</div>}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
              <p className="font-semibold">Error:</p>
              <p>{error}</p>
            </div>
          )}

          {result && (
            <div className="bg-gray-50 rounded p-4">
              <pre className="text-xs overflow-auto">
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Key Points to Verify</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="list-disc pl-5 space-y-2 text-sm">
            <li><strong>Invalid Users:</strong> Should show error "User not found in the system" - NOT default to admin</li>
            <li><strong>Managers (e.g., TB0016):</strong> Should see all team leaders under them in TL filter, all field users in user filter</li>
            <li><strong>Team Leaders (e.g., TB0113):</strong> If no subordinate TLs, should see only themselves in TL filter</li>
            <li><strong>Field Users Filter:</strong> Should show all users in the hierarchy (from getChildUsers)</li>
            <li><strong>Team Leader Filter:</strong> Should adapt based on user's position in hierarchy</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
