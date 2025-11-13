import { NextRequest, NextResponse } from 'next/server'
import sql from 'mssql'

// Force dynamic rendering for routes that use searchParams
export const dynamic = 'force-dynamic'

const mssqlConfig = {
  server: '10.20.53.178',
  port: 1433,
  database: 'FarmleyQA',
  user: 'farmleyqa',
  password: 'Winit%123$',
  options: {
    encrypt: false,
    trustServerCertificate: true,
    enableArithAbort: true
  }
}

export async function GET(request: NextRequest) {
  let pool: sql.ConnectionPool | null = null
  
  try {
    const searchParams = request.nextUrl.searchParams
    const userCode = searchParams.get('userCode') || 'TB1302'
    
    console.log(`Testing MSSQL connection and udf_GetAllChildUsersESF for userCode: ${userCode}`)
    console.log('Config:', { server: mssqlConfig.server, database: mssqlConfig.database })
    
    // Create connection pool
    pool = await sql.connect(mssqlConfig)
    console.log('MSSQL connection successful!')
    
    // Try to list all user-defined functions and stored procedures
    console.log('Checking for available functions...')
    const functionsResult = await pool.request()
      .query(`
        SELECT 
          SCHEMA_NAME(schema_id) as schema_name, 
          name as object_name,
          type_desc as object_type
        FROM sys.objects
        WHERE type IN ('FN', 'IF', 'TF', 'P')
        AND (name LIKE '%Child%' OR name LIKE '%ESF%' OR name LIKE '%User%' OR name LIKE '%Subordinate%' OR name LIKE '%Hierarchy%')
        ORDER BY name
      `)
    
    console.log('Available functions/procedures:', JSON.stringify(functionsResult.recordset))
    
    // Also list ALL functions and procedures
    const allFunctionsResult = await pool.request()
      .query(`
        SELECT 
          SCHEMA_NAME(schema_id) as schema_name, 
          name as object_name,
          type_desc as object_type
        FROM sys.objects
        WHERE type IN ('FN', 'IF', 'TF', 'P')
        ORDER BY name
      `)
    
    // Also check the tblUser table structure
    const userTableInfo = await pool.request()
      .query(`
        SELECT TOP 5 * FROM dbo.tblUser
      `)
    
    console.log('Available functions:', JSON.stringify(functionsResult.recordset))
    
    // Call the function as a table-valued function
    console.log(`Calling: SELECT * FROM [udf_GetAllChildUsersESF]('${userCode}')`)
    const result = await pool.request()
      .query(`SELECT * FROM [udf_GetAllChildUsersESF]('${userCode}')`)
    
    console.log(`Query executed successfully. Rows returned: ${result.recordset.length}`)
    
    // Log sample of first 3 rows
    if (result.recordset.length > 0) {
      console.log('First row sample:', JSON.stringify(result.recordset[0]))
      console.log('Columns:', Object.keys(result.recordset[0]))
    }
    
    return NextResponse.json({
      success: true,
      userCode,
      totalChildUsers: result.recordset.length,
      childUsers: result.recordset,
      sampleRows: result.recordset.slice(0, 5), // First 5 rows
      columns: result.recordset.length > 0 ? Object.keys(result.recordset[0]) : [],
      availableFunctionsAndProcedures: functionsResult.recordset,
      allFunctionsAndProcedures: allFunctionsResult.recordset,
      userTableSample: userTableInfo.recordset,
      userTableColumns: userTableInfo.recordset.length > 0 ? Object.keys(userTableInfo.recordset[0]) : [],
      message: 'MSSQL connection and query successful'
    })
    
  } catch (error: any) {
    console.error('MSSQL Test Error:', error)
    console.error('Error name:', error?.name)
    console.error('Error code:', error?.code)
    console.error('Error number:', error?.number)
    
    return NextResponse.json({
      success: false,
      error: 'Failed to test MSSQL connection',
      message: error instanceof Error ? error.message : 'Unknown error',
      errorName: error?.name || 'Unknown',
      errorCode: error?.code || 'N/A',
      errorNumber: error?.number || 'N/A',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
    
  } finally {
    // Close the connection
    if (pool) {
      try {
        await pool.close()
        console.log('MSSQL connection closed')
      } catch (err) {
        console.error('Error closing MSSQL connection:', err)
      }
    }
  }
}
