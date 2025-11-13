// Database configuration
export interface DatabaseConfig {
  host: string
  port: number
  database: string
  user: string
  password: string
  ssl?: boolean
  max?: number // connection pool size
  idleTimeoutMillis?: number
  connectionTimeoutMillis?: number
}

export interface RedisConfig {
  host: string
  port: number
  password?: string
  db?: number
  keyPrefix?: string
  retryDelayOnFailover?: number
  maxRetriesPerRequest?: number
}

export const getDatabaseConfig = (): DatabaseConfig => {
  return {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'postgres',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    ssl: process.env.DB_SSL === 'true',
    max: parseInt(process.env.DB_POOL_SIZE || '30'), // Increased pool size for parallel queries
    idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000'),
    connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '30000') // Increased timeout
  }
}

export const getRedisConfig = (): RedisConfig => {
  return {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB || '0'),
    keyPrefix: process.env.REDIS_KEY_PREFIX || 'sfa:',
    retryDelayOnFailover: parseInt(process.env.REDIS_RETRY_DELAY || '100'),
    maxRetriesPerRequest: parseInt(process.env.REDIS_MAX_RETRIES || '3')
  }
}

// Cache TTL configurations (in seconds)
export const CACHE_TTL = {
  DASHBOARD_KPI: 300, // 5 minutes
  SALES_TREND: 900, // 15 minutes
  TOP_CUSTOMERS: 1800, // 30 minutes
  TOP_PRODUCTS: 1800, // 30 minutes
  TRANSACTIONS: 600, // 10 minutes
  CUSTOMERS: 3600, // 1 hour
  PRODUCTS: 7200, // 2 hours
  JOURNEYS: 1800, // 30 minutes
  VISITS: 600, // 10 minutes
  TARGETS: 1800 // 30 minutes
} as const

// Real-time update keys for cache invalidation
export const CACHE_INVALIDATION_KEYS = {
  NEW_TRANSACTION: ['DASHBOARD_KPI', 'SALES_TREND', 'TRANSACTIONS'],
  CUSTOMER_UPDATE: ['CUSTOMERS', 'TOP_CUSTOMERS', 'DASHBOARD_KPI'],
  PRODUCT_UPDATE: ['PRODUCTS', 'TOP_PRODUCTS'],
  JOURNEY_COMPLETE: ['JOURNEYS', 'VISITS', 'DASHBOARD_KPI'],
  TARGET_UPDATE: ['TARGETS', 'DASHBOARD_KPI']
} as const