import { Pool, PoolClient, QueryResult } from 'pg'
import { getDatabaseConfig } from '../config/database'

class DatabaseConnection {
  private static instance: DatabaseConnection
  private pool: Pool | null = null

  private constructor() {}

  public static getInstance(): DatabaseConnection {
    if (!DatabaseConnection.instance) {
      DatabaseConnection.instance = new DatabaseConnection()
    }
    return DatabaseConnection.instance
  }

  public async initialize(): Promise<void> {
    if (this.pool) {
      return
    }

    const config = getDatabaseConfig()

    this.pool = new Pool({
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.user,
      password: config.password,
      ssl: config.ssl ? { rejectUnauthorized: false } : false,
      max: config.max,
      idleTimeoutMillis: config.idleTimeoutMillis,
      connectionTimeoutMillis: config.connectionTimeoutMillis,
    })

    // Test connection
    try {
      const client = await this.pool.connect()
      await client.query('SELECT 1')
      client.release()
      console.log('Database connection established successfully')
    } catch (error) {
      console.error('Failed to connect to database:', error)
      throw error
    }

    // Handle pool errors
    this.pool.on('error', (err) => {
      console.error('Unexpected error on idle client', err)
    })
  }

  public async query<T = any>(text: string, params?: any[]): Promise<QueryResult<T>> {
    if (!this.pool) {
      await this.initialize()
    }

    const start = Date.now()
    try {
      const result = await this.pool!.query(text, params)
      const duration = Date.now() - start

      if (duration > 1000) {
        console.warn(`Slow query detected (${duration}ms):`, text.substring(0, 100))
      }

      return result
    } catch (error) {
      console.error('Database query error:', error)
      console.error('Query:', text)
      console.error('Params:', params)
      throw error
    }
  }

  public async getClient(): Promise<PoolClient> {
    if (!this.pool) {
      await this.initialize()
    }
    return this.pool!.connect()
  }

  public async transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.getClient()
    try {
      await client.query('BEGIN')
      const result = await callback(client)
      await client.query('COMMIT')
      return result
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }

  public async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end()
      this.pool = null
    }
  }

  public async getTableSchema(tableName: string): Promise<any[]> {
    const query = `
      SELECT
        column_name,
        data_type,
        is_nullable,
        column_default,
        character_maximum_length,
        numeric_precision,
        numeric_scale
      FROM information_schema.columns
      WHERE table_name = $1
      ORDER BY ordinal_position
    `
    const result = await this.query(query, [tableName])
    return result.rows
  }

  public async getAllTables(): Promise<string[]> {
    const query = `
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename
    `
    const result = await this.query(query)
    return result.rows.map(row => row.tablename)
  }

  public async getTableRowCount(tableName: string): Promise<number> {
    const result = await this.query(`SELECT COUNT(*) as count FROM ${tableName}`)
    return parseInt(result.rows[0].count)
  }
}

// Export singleton instance
export const db = DatabaseConnection.getInstance()

// Export query functions for convenient usage
export const query = async <T = any>(text: string, params?: any[]): Promise<QueryResult<T>> => {
  return db.query<T>(text, params)
}

export const queryOne = async <T = any>(text: string, params?: any[]): Promise<T | null> => {
  const result = await db.query<T>(text, params)
  return result.rows.length > 0 ? result.rows[0] : null
}

export const queryAll = async <T = any>(text: string, params?: any[]): Promise<T[]> => {
  const result = await db.query<T>(text, params)
  return result.rows
}

// Utility functions for common query patterns
export const buildWhereClause = (filters: Record<string, any>): { clause: string; params: any[] } => {
  const conditions: string[] = []
  const params: any[] = []
  let paramIndex = 1

  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      if (Array.isArray(value)) {
        const placeholders = value.map(() => `$${paramIndex++}`).join(',')
        conditions.push(`${key} IN (${placeholders})`)
        params.push(...value)
      } else if (typeof value === 'string' && value.includes('%')) {
        conditions.push(`${key} ILIKE $${paramIndex++}`)
        params.push(value)
      } else {
        conditions.push(`${key} = $${paramIndex++}`)
        params.push(value)
      }
    }
  })

  return {
    clause: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
    params
  }
}

export const buildOrderClause = (orderBy?: string, orderDir: 'ASC' | 'DESC' = 'DESC'): string => {
  return orderBy ? `ORDER BY ${orderBy} ${orderDir}` : ''
}

export const buildLimitClause = (limit?: number, offset?: number): string => {
  let clause = ''
  if (limit) clause += `LIMIT ${limit}`
  if (offset) clause += ` OFFSET ${offset}`
  return clause
}