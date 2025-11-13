import { NextResponse } from 'next/server'
import { getStockCheckSummary } from '@/services/dailyStockService'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const dateRange = searchParams.get('dateRange')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const regionCode = searchParams.get('regionCode')
    const teamLeaderCode = searchParams.get('teamLeaderCode')
    const fieldUserRole = searchParams.get('fieldUserRole')
    const userCode = searchParams.get('userCode')
    const chainName = searchParams.get('chainName')
    const storeCode = searchParams.get('storeCode')
    const productCode = searchParams.get('productCode')
    const productCategory = searchParams.get('productCategory')

    const filters: any = {}
    if (dateRange) filters.dateRange = dateRange
    if (startDate) filters.startDate = startDate
    if (endDate) filters.endDate = endDate
    if (regionCode) filters.regionCode = regionCode
    if (fieldUserRole) filters.fieldUserRole = fieldUserRole
    if (userCode) filters.userCode = userCode
    if (chainName) filters.chainName = chainName
    if (storeCode) filters.storeCode = storeCode
    if (productCode) filters.productCode = productCode
    if (productCategory) filters.productCategory = productCategory

    // Handle team leader filter - get field users from hierarchy
    if (teamLeaderCode) {
      try {
        const url = new URL(request.url)
        const hierarchyResponse = await fetch(`${url.origin}/api/users/hierarchy`)
        if (hierarchyResponse.ok) {
          const hierarchyData = await hierarchyResponse.json()
          const tlData = hierarchyData.data.teamLeaders.find((tl: any) => tl.code === teamLeaderCode)
          
          if (tlData && tlData.fieldUsers && tlData.fieldUsers.length > 0) {
            // Pass field user codes instead of team leader code
            filters.fieldUserCodes = tlData.fieldUsers.map((fu: any) => fu.code)
          } else {
            // Fallback to team leader code
            filters.teamLeaderCode = teamLeaderCode
          }
        } else {
          filters.teamLeaderCode = teamLeaderCode
        }
      } catch (error) {
        console.warn('Failed to fetch hierarchy for team leader:', error)
        filters.teamLeaderCode = teamLeaderCode
      }
    }

    const data = await getStockCheckSummary(filters)
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error in stock summary API:', error)
    return NextResponse.json(
      { error: 'Failed to fetch stock summary' },
      { status: 500 }
    )
  }
}
