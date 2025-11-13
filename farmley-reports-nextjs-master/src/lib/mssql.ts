import sql from 'mssql'

const mssqlConfig = {
  server: process.env.MSSQL_SERVER || '10.20.53.178',
  port: parseInt(process.env.MSSQL_PORT || '1433'),
  database: process.env.MSSQL_DATABASE || 'FarmleyQA',
  user: process.env.MSSQL_USER || 'farmleyqa',
  password: process.env.MSSQL_PASSWORD || 'Winit%123$',
  options: {
    encrypt: false,
    trustServerCertificate: true,
    enableArithAbort: true
  }
}

let pool: sql.ConnectionPool | null = null

export async function getMSSQLConnection() {
  if (!pool) {
    pool = await sql.connect(mssqlConfig)
  }
  return pool
}

export async function closeMSSQLConnection() {
  if (pool) {
    await pool.close()
    pool = null
  }
}

/**
 * Get all child users for a given user code using the udf_GetAllChildUsersESF function
 * Returns array of user codes that report to the given user (including the user themselves)
 */
export async function getChildUsers(userCode: string): Promise<string[]> {
  try {
    // Special case: admin sees all data
    if (userCode.toLowerCase() === 'admin') {
      return []
    }

    const pool = await getMSSQLConnection()
    const result = await pool.request()
      .query(`SELECT * FROM [udf_GetAllChildUsersESF]('${userCode}')`)
    
    // Extract user codes from the result
    const userCodes = result.recordset.map((row: any) => row.UserCode)
    
    // CRITICAL: Check if user exists in hierarchy
    // If empty result, it means user doesn't exist in the system
    if (userCodes.length === 0) {
      console.error(`User ${userCode} not found in hierarchy system`)
      // Don't default to admin! Throw error for invalid user
      throw new Error(`USER_NOT_FOUND: User ${userCode} is not valid in the hierarchy system`)
    }
    
    console.log(`User ${userCode} has ${userCodes.length} child users:`, userCodes)
    
    return userCodes
  } catch (error: any) {
    // If it's already our USER_NOT_FOUND error, re-throw it
    if (error.message && error.message.includes('USER_NOT_FOUND')) {
      throw error
    }
    console.error('Error fetching child users:', error)
    throw new Error(`Failed to fetch child users for ${userCode}`)
  }
}

/**
 * Check if a user code should see all data (admin)
 */
export function isAdmin(userCode: string): boolean {
  return userCode.toLowerCase() === 'admin'
}

/**
 * Get user hierarchy information
 * Returns user details including their subordinates grouped by role
 */
export async function getUserHierarchyInfo(userCode: string): Promise<{
  userCode: string
  allSubordinates: string[]
  teamLeaders: string[]
  fieldUsers: string[]
  isTeamLeader: boolean
}> {
  try {
    if (userCode.toLowerCase() === 'admin') {
      return {
        userCode: 'admin',
        allSubordinates: [],
        teamLeaders: [],
        fieldUsers: [],
        isTeamLeader: false
      }
    }

    const pool = await getMSSQLConnection()
    const result = await pool.request()
      .query(`SELECT * FROM [udf_GetAllChildUsersESF]('${userCode}')`)
    
    const allSubordinates = result.recordset.map((row: any) => row.UserCode)
    
    // Check if the user themselves is a team leader by seeing if they're the only one
    // or if there are others reporting to them
    const isTeamLeader = allSubordinates.includes(userCode) && allSubordinates.length > 1
    
    return {
      userCode,
      allSubordinates,
      teamLeaders: isTeamLeader ? [userCode] : allSubordinates, // If TL, only themselves; else all subordinates can be TLs
      fieldUsers: allSubordinates.filter(code => code !== userCode), // Everyone except the logged-in user
      isTeamLeader
    }
  } catch (error) {
    console.error('Error fetching user hierarchy info:', error)
    throw new Error(`Failed to fetch hierarchy info for ${userCode}`)
  }
}
