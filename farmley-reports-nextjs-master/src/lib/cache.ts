import Redis from 'ioredis'
import { getRedisConfig, CACHE_TTL, CACHE_INVALIDATION_KEYS } from '../config/database'

class CacheManager {
  private static instance: CacheManager
  private redis: Redis | null = null
  private fallbackCache = new Map<string, { data: any; expires: number }>()

  private constructor() {}

  public static getInstance(): CacheManager {
    if (!CacheManager.instance) {
      CacheManager.instance = new CacheManager()
    }
    return CacheManager.instance
  }

  public async initialize(): Promise<void> {
    if (this.redis) {
      return
    }

    const config = getRedisConfig()

    try {
      this.redis = new Redis({
        host: config.host,
        port: config.port,
        password: config.password,
        db: config.db,
        keyPrefix: config.keyPrefix,
        retryDelayOnFailover: config.retryDelayOnFailover,
        maxRetriesPerRequest: config.maxRetriesPerRequest,
        lazyConnect: true,
        reconnectOnError: (err) => {
          const targetError = 'READONLY'
          return err.message.includes(targetError)
        },
        retryDelayOnClusterDown: 300,
        enableReadyCheck: false,
        maxRetriesPerRequest: null,
      })

      await this.redis.connect()

      this.redis.on('connect', () => {
        console.log('Redis connected successfully')
      })

      this.redis.on('error', (error) => {
        console.warn('Redis error, falling back to memory cache:', error.message)
      })

      this.redis.on('close', () => {
        console.warn('Redis connection closed, using memory cache')
      })

      // Test connection
      await this.redis.ping()

    } catch (error) {
      console.warn('Failed to connect to Redis, using memory cache:', error)
      this.redis = null
    }
  }

  private isRedisAvailable(): boolean {
    return this.redis !== null && this.redis.status === 'ready'
  }

  private cleanupMemoryCache(): void {
    const now = Date.now()
    for (const [key, value] of this.fallbackCache.entries()) {
      if (value.expires < now) {
        this.fallbackCache.delete(key)
      }
    }
  }

  public async get<T = any>(key: string): Promise<T | null> {
    try {
      if (this.isRedisAvailable()) {
        const data = await this.redis!.get(key)
        return data ? JSON.parse(data) : null
      } else {
        // Fallback to memory cache
        this.cleanupMemoryCache()
        const cached = this.fallbackCache.get(key)
        if (cached && cached.expires > Date.now()) {
          return cached.data
        }
        return null
      }
    } catch (error) {
      console.error('Cache get error:', error)
      return null
    }
  }

  public async set(key: string, value: any, ttlSeconds?: number): Promise<void> {
    try {
      const serialized = JSON.stringify(value)

      if (this.isRedisAvailable()) {
        if (ttlSeconds) {
          await this.redis!.setex(key, ttlSeconds, serialized)
        } else {
          await this.redis!.set(key, serialized)
        }
      } else {
        // Fallback to memory cache
        const expires = ttlSeconds ? Date.now() + (ttlSeconds * 1000) : Date.now() + (3600 * 1000) // 1 hour default
        this.fallbackCache.set(key, { data: value, expires })
        this.cleanupMemoryCache()
      }
    } catch (error) {
      console.error('Cache set error:', error)
    }
  }

  public async del(key: string | string[]): Promise<void> {
    try {
      if (this.isRedisAvailable()) {
        if (Array.isArray(key)) {
          await this.redis!.del(...key)
        } else {
          await this.redis!.del(key)
        }
      } else {
        // Fallback to memory cache
        if (Array.isArray(key)) {
          key.forEach(k => this.fallbackCache.delete(k))
        } else {
          this.fallbackCache.delete(key)
        }
      }
    } catch (error) {
      console.error('Cache delete error:', error)
    }
  }

  public async invalidatePattern(pattern: string): Promise<void> {
    try {
      if (this.isRedisAvailable()) {
        const keys = await this.redis!.keys(pattern)
        if (keys.length > 0) {
          await this.redis!.del(...keys)
        }
      } else {
        // Fallback to memory cache - simple pattern matching
        const regex = new RegExp(pattern.replace('*', '.*'))
        const keysToDelete = Array.from(this.fallbackCache.keys()).filter(key => regex.test(key))
        keysToDelete.forEach(key => this.fallbackCache.delete(key))
      }
    } catch (error) {
      console.error('Cache pattern invalidation error:', error)
    }
  }

  public async getOrSet<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttlSeconds?: number
  ): Promise<T> {
    const cached = await this.get<T>(key)
    if (cached !== null) {
      return cached
    }

    const data = await fetcher()
    await this.set(key, data, ttlSeconds)
    return data
  }

  // Specialized cache methods for different data types
  public async cacheKPI(data: any): Promise<void> {
    await this.set('dashboard:kpi', data, CACHE_TTL.DASHBOARD_KPI)
  }

  public async getCachedKPI(): Promise<any | null> {
    return this.get('dashboard:kpi')
  }

  public async cacheSalesTrend(data: any, days: number): Promise<void> {
    await this.set(`sales:trend:${days}`, data, CACHE_TTL.SALES_TREND)
  }

  public async getCachedSalesTrend(days: number): Promise<any | null> {
    return this.get(`sales:trend:${days}`)
  }

  public async cacheTopCustomers(data: any, limit: number): Promise<void> {
    await this.set(`customers:top:${limit}`, data, CACHE_TTL.TOP_CUSTOMERS)
  }

  public async getCachedTopCustomers(limit: number): Promise<any | null> {
    return this.get(`customers:top:${limit}`)
  }

  public async cacheTopProducts(data: any, limit: number): Promise<void> {
    await this.set(`products:top:${limit}`, data, CACHE_TTL.TOP_PRODUCTS)
  }

  public async getCachedTopProducts(limit: number): Promise<any | null> {
    return this.get(`products:top:${limit}`)
  }

  // Cache invalidation for real-time updates
  public async invalidateOnNewTransaction(): Promise<void> {
    const keys = CACHE_INVALIDATION_KEYS.NEW_TRANSACTION.map(key => `*${key.toLowerCase()}*`)
    for (const pattern of keys) {
      await this.invalidatePattern(pattern)
    }
  }

  public async invalidateOnCustomerUpdate(): Promise<void> {
    const keys = CACHE_INVALIDATION_KEYS.CUSTOMER_UPDATE.map(key => `*${key.toLowerCase()}*`)
    for (const pattern of keys) {
      await this.invalidatePattern(pattern)
    }
  }

  public async invalidateOnProductUpdate(): Promise<void> {
    const keys = CACHE_INVALIDATION_KEYS.PRODUCT_UPDATE.map(key => `*${key.toLowerCase()}*`)
    for (const pattern of keys) {
      await this.invalidatePattern(pattern)
    }
  }

  public async close(): Promise<void> {
    if (this.redis) {
      await this.redis.quit()
      this.redis = null
    }
    this.fallbackCache.clear()
  }
}

// Export singleton instance
export const cache = CacheManager.getInstance()

// Utility function to generate cache keys
export const generateCacheKey = (prefix: string, ...parts: (string | number)[]): string => {
  return `${prefix}:${parts.join(':')}`
}

// Cache warming utility
export const warmCache = async (keys: string[], fetchers: (() => Promise<any>)[]): Promise<void> => {
  const promises = keys.map(async (key, index) => {
    const cached = await cache.get(key)
    if (cached === null && fetchers[index]) {
      const data = await fetchers[index]()
      await cache.set(key, data)
    }
  })

  await Promise.allSettled(promises)
}