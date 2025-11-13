import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/database'
import { getChildUsers, isAdmin } from '@/lib/mssql'

// Force dynamic rendering for routes that use searchParams
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const loginUserCode = searchParams.get('userCode')
    
    if (!loginUserCode) {
      return NextResponse.json({
        error: 'Please provide userCode parameter'
      }, { status: 400 })
    }
    
    console.log('Testing hierarchy for user:', loginUserCode)
    
    // Step 1: Check if admin
    if (isAdmin(loginUserCode)) {
      return NextResponse.json({
        userCode: loginUserCode,
        isAdmin: true,
        message: 'Admin user - sees all data',
        hierarchy: {
          childUsers: [],
          teamLeaders: 'ALL',
          fieldUsers: 'ALL'
        }
      })
    }
    
    // Step 2: Get child users from MSSQL
    let childUsers: string[] = []
    try {
      childUsers = await getChildUsers(loginUserCode)
    } catch (error: any) {
      if (error.message && error.message.includes('USER_NOT_FOUND')) {
        return NextResponse.json({
          userCode: loginUserCode,
          isAdmin: false,
          error: `User ${loginUserCode} not found in hierarchy system`,
          isUserNotFound: true
        }, { status: 404 })
      }
      throw error
    }
    
    console.log(`Found ${childUsers.length} child users for ${loginUserCode}:`, childUsers)
    
    // Step 3: Analyze the user's role and their team structure
    const userCodesStr = childUsers.map(code => `'${code}'`).join(', ')
    
    // Check if the logged-in user appears as a team leader
    const userAsTLResult = await query(`
      SELECT DISTINCT 
        tl_code,
        tl_name,
        COUNT(DISTINCT field_user_code) as field_user_count,
        COUNT(DISTINCT store_code) as store_count
      FROM flat_sales_transactions
      WHERE tl_code = '${loginUserCode}'
      GROUP BY tl_code, tl_name
    `)
    
    const isUserTeamLeader = userAsTLResult.rows.length > 0
    
    // Get all unique team leaders from the child users
    const teamLeadersResult = await query(`
      SELECT DISTINCT 
        tl_code,
        tl_name,
        COUNT(DISTINCT field_user_code) as field_user_count
      FROM flat_sales_transactions
      WHERE field_user_code IN (${userCodesStr})
        AND tl_code IS NOT NULL
      GROUP BY tl_code, tl_name
      ORDER BY tl_code
    `)
    
    const teamLeaders = teamLeadersResult.rows.map(r => ({
      code: r.tl_code,
      name: r.tl_name,
      fieldUserCount: r.field_user_count
    }))
    
    // Get field users with their roles
    const fieldUsersResult = await query(`
      SELECT DISTINCT 
        field_user_code,
        field_user_name,
        user_role,
        tl_code,
        tl_name
      FROM flat_sales_transactions
      WHERE field_user_code IN (${userCodesStr})
        AND field_user_code IS NOT NULL
      ORDER BY field_user_code
    `)
    
    const fieldUsersByRole = {
      teamLeaders: [] as any[],
      atl: [] as any[],
      promoters: [] as any[],
      merchandisers: [] as any[],
      fieldUsers: [] as any[]
    }
    
    fieldUsersResult.rows.forEach(user => {
      const userInfo = {
        code: user.field_user_code,
        name: user.field_user_name,
        role: user.user_role || 'Field User',
        reportingTo: user.tl_code
      }
      
      if (user.user_role === 'Team Leader') {
        fieldUsersByRole.teamLeaders.push(userInfo)
      } else if (user.user_role === 'ATL' || user.user_role === 'Assistant Team Leader') {
        fieldUsersByRole.atl.push(userInfo)
      } else if (user.user_role === 'Promoter') {
        fieldUsersByRole.promoters.push(userInfo)
      } else if (user.user_role === 'Merchandiser') {
        fieldUsersByRole.merchandisers.push(userInfo)
      } else {
        fieldUsersByRole.fieldUsers.push(userInfo)
      }
    })
    
    // Determine user's position in hierarchy
    let userPosition = 'Unknown'
    let hierarchyLevel = 0
    
    if (isUserTeamLeader) {
      // User is a team leader
      if (teamLeaders.length === 1 && teamLeaders[0].code === loginUserCode) {
        userPosition = 'Team Leader (No subordinate TLs)'
        hierarchyLevel = 2
      } else if (teamLeaders.length > 1) {
        userPosition = 'Manager/Team Leader (Has subordinate TLs)'
        hierarchyLevel = 3
      } else {
        userPosition = 'Team Leader'
        hierarchyLevel = 2
      }
    } else {
      // User is not a team leader but has subordinates
      if (teamLeaders.length > 0) {
        userPosition = 'Senior Manager/Manager (Above TLs)'
        hierarchyLevel = 4
      } else if (childUsers.length > 1) {
        userPosition = 'Supervisor (Has direct reports)'
        hierarchyLevel = 1
      } else {
        userPosition = 'Individual Contributor'
        hierarchyLevel = 0
      }
    }
    
    // Determine what should show in filters
    let teamLeaderFilter = []
    let fieldUserFilter = childUsers
    
    if (hierarchyLevel >= 3) {
      // Manager or above - show all team leaders under them
      teamLeaderFilter = teamLeaders.map(tl => tl.code)
    } else if (isUserTeamLeader) {
      // Team leader with no subordinate TLs - show only themselves
      teamLeaderFilter = [loginUserCode]
    } else {
      // Not a team leader but might have TLs under them
      teamLeaderFilter = teamLeaders.map(tl => tl.code)
    }
    
    return NextResponse.json({
      userCode: loginUserCode,
      isAdmin: false,
      userInfo: userAsTLResult.rows[0] || null,
      analysis: {
        isUserTeamLeader,
        userPosition,
        hierarchyLevel,
        childUserCount: childUsers.length,
        teamLeaderCount: teamLeaders.length,
        explanation: getExplanation(userPosition, hierarchyLevel)
      },
      hierarchy: {
        childUsers,
        teamLeaders,
        fieldUsersByRole
      },
      filters: {
        teamLeaderFilter: teamLeaderFilter,
        fieldUserFilter: fieldUserFilter,
        explanation: {
          teamLeader: teamLeaderFilter.length === 0 ? 'No team leaders to show' : 
                      teamLeaderFilter.length === 1 && teamLeaderFilter[0] === loginUserCode ? 
                      'Shows only yourself as team leader' : 
                      `Shows ${teamLeaderFilter.length} team leaders under you`,
          fieldUser: `Shows all ${fieldUserFilter.length} users in your hierarchy`
        }
      }
    })
    
  } catch (error) {
    console.error('Error testing hierarchy:', error)
    return NextResponse.json({
      error: 'Failed to test hierarchy',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

function getExplanation(position: string, level: number): string {
  switch(level) {
    case 4:
      return 'You are a senior manager/director overseeing multiple team leaders. You can see all team leaders and their field users in your hierarchy.'
    case 3:
      return 'You are a manager/team leader with other team leaders reporting to you. You can see all subordinate team leaders and all field users in your hierarchy.'
    case 2:
      return 'You are a team leader directly managing field users. You see yourself in the team leader filter and your field users in the user filter.'
    case 1:
      return 'You are a supervisor with direct reports but not classified as a team leader. You can see your direct reports.'
    case 0:
      return 'You are an individual contributor with no reports.'
    default:
      return 'Your position in the hierarchy could not be determined.'
  }
}
