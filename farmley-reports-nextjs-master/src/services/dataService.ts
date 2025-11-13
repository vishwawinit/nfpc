import type {
  Transaction,
  Customer,
  Product,
  Journey,
  Visit,
  Target,
  DashboardKPI,
  SalesTrendData,
  FilterOptions
} from '../types'
import { mockData } from './mockData'

// Interface for data service - easy to swap implementations
export interface IDataService {
  // Dashboard
  getDashboardKPIs(): Promise<DashboardKPI>
  getSalesTrend(days: number): Promise<SalesTrendData[]>

  // Transactions
  getTransactions(filters?: FilterOptions): Promise<Transaction[]>
  getTransaction(trxCode: string): Promise<Transaction | null>

  // Customers
  getCustomers(filters?: FilterOptions): Promise<Customer[]>
  getCustomer(customerCode: string): Promise<Customer | null>
  getTopCustomers(limit?: number): Promise<Customer[]>

  // Products
  getProducts(filters?: FilterOptions): Promise<Product[]>
  getProduct(itemCode: string): Promise<Product | null>
  getTopProducts(limit?: number): Promise<Product[]>

  // Journeys & Visits
  getJourneys(filters?: FilterOptions): Promise<Journey[]>
  getJourney(journeyCode: string): Promise<Journey | null>
  getVisits(journeyCode?: string): Promise<Visit[]>
  getVisit(visitId: string): Promise<Visit | null>

  // Targets
  getTargets(filters?: FilterOptions): Promise<Target[]>
  getTarget(targetCode: string): Promise<Target | null>
}

// Mock implementation
class MockDataService implements IDataService {
  // Simulate network delay
  private delay(ms: number = 300): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  // Dashboard
  async getDashboardKPIs(): Promise<DashboardKPI> {
    await this.delay(200)
    return mockData.dashboardKPIs
  }

  async getSalesTrend(days: number): Promise<SalesTrendData[]> {
    await this.delay(300)
    return mockData.salesTrend.slice(-days)
  }

  // Transactions
  async getTransactions(filters?: FilterOptions): Promise<Transaction[]> {
    await this.delay(400)
    let transactions = [...mockData.transactions]

    if (filters) {
      if (filters.startDate && filters.endDate) {
        transactions = transactions.filter(t =>
          t.trxDate >= filters.startDate && t.trxDate <= filters.endDate
        )
      }
      if (filters.routeCode) {
        transactions = transactions.filter(t => t.routeCode === filters.routeCode)
      }
      if (filters.userCode) {
        transactions = transactions.filter(t => t.userCode === filters.userCode)
      }
    }

    return transactions
  }

  async getTransaction(trxCode: string): Promise<Transaction | null> {
    await this.delay(200)
    return mockData.transactions.find(t => t.trxCode === trxCode) || null
  }

  // Customers
  async getCustomers(filters?: FilterOptions): Promise<Customer[]> {
    await this.delay(400)
    let customers = [...mockData.customers]

    if (filters) {
      if (filters.routeCode) {
        customers = customers.filter(c => c.routeCode === filters.routeCode)
      }
      if (filters.customerType) {
        customers = customers.filter(c => c.customerType === filters.customerType)
      }
    }

    return customers
  }

  async getCustomer(customerCode: string): Promise<Customer | null> {
    await this.delay(200)
    return mockData.customers.find(c => c.customerCode === customerCode) || null
  }

  async getTopCustomers(limit = 20): Promise<Customer[]> {
    await this.delay(300)
    return mockData.customers.slice(0, limit)
  }

  // Products
  async getProducts(filters?: FilterOptions): Promise<Product[]> {
    await this.delay(400)
    let products = [...mockData.products]

    if (filters?.productCategory) {
      products = products.filter(p => p.category === filters.productCategory)
    }

    return products
  }

  async getProduct(itemCode: string): Promise<Product | null> {
    await this.delay(200)
    return mockData.products.find(p => p.itemCode === itemCode) || null
  }

  async getTopProducts(limit = 20): Promise<Product[]> {
    await this.delay(300)
    return mockData.products.slice(0, limit)
  }

  // Journeys & Visits
  async getJourneys(filters?: FilterOptions): Promise<Journey[]> {
    await this.delay(400)
    let journeys = [...mockData.journeys]

    if (filters) {
      if (filters.startDate && filters.endDate) {
        journeys = journeys.filter(j =>
          j.journeyDate >= filters.startDate && j.journeyDate <= filters.endDate
        )
      }
      if (filters.routeCode) {
        journeys = journeys.filter(j => j.routeCode === filters.routeCode)
      }
      if (filters.userCode) {
        journeys = journeys.filter(j => j.userCode === filters.userCode)
      }
    }

    return journeys
  }

  async getJourney(journeyCode: string): Promise<Journey | null> {
    await this.delay(200)
    return mockData.journeys.find(j => j.journeyCode === journeyCode) || null
  }

  async getVisits(journeyCode?: string): Promise<Visit[]> {
    await this.delay(400)
    if (journeyCode) {
      return mockData.visits.filter(v => v.journeyCode === journeyCode)
    }
    return mockData.visits
  }

  async getVisit(visitId: string): Promise<Visit | null> {
    await this.delay(200)
    return mockData.visits.find(v => v.visitId === visitId) || null
  }

  // Targets
  async getTargets(filters?: FilterOptions): Promise<Target[]> {
    await this.delay(300)
    let targets = [...mockData.targets]

    if (filters?.userCode) {
      targets = targets.filter(t => t.userCode === filters.userCode)
    }

    return targets
  }

  async getTarget(targetCode: string): Promise<Target | null> {
    await this.delay(200)
    return mockData.targets.find(t => t.targetCode === targetCode) || null
  }
}

// Future API implementation (example structure)
class APIDataService implements IDataService {
  private baseURL: string

  constructor(baseURL: string) {
    this.baseURL = baseURL
  }

  private async fetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers
      }
    })

    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`)
    }

    return response.json()
  }

  // Implement all methods using fetch
  async getDashboardKPIs(): Promise<DashboardKPI> {
    return this.fetch<DashboardKPI>('/api/dashboard/kpis')
  }

  async getSalesTrend(days: number): Promise<SalesTrendData[]> {
    return this.fetch<SalesTrendData[]>(`/api/dashboard/sales-trend?days=${days}`)
  }

  async getTransactions(filters?: FilterOptions): Promise<Transaction[]> {
    const params = new URLSearchParams()
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, String(value))
      })
    }
    return this.fetch<Transaction[]>(`/api/transactions?${params}`)
  }

  async getTransaction(trxCode: string): Promise<Transaction | null> {
    return this.fetch<Transaction | null>(`/api/transactions/${trxCode}`)
  }

  async getCustomers(filters?: FilterOptions): Promise<Customer[]> {
    const params = new URLSearchParams()
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, String(value))
      })
    }
    return this.fetch<Customer[]>(`/api/customers?${params}`)
  }

  async getCustomer(customerCode: string): Promise<Customer | null> {
    return this.fetch<Customer | null>(`/api/customers/${customerCode}`)
  }

  async getTopCustomers(limit = 20): Promise<Customer[]> {
    return this.fetch<Customer[]>(`/api/customers/top?limit=${limit}`)
  }

  async getProducts(filters?: FilterOptions): Promise<Product[]> {
    const params = new URLSearchParams()
    if (filters?.productCategory) {
      params.append('category', filters.productCategory)
    }
    return this.fetch<Product[]>(`/api/products?${params}`)
  }

  async getProduct(itemCode: string): Promise<Product | null> {
    return this.fetch<Product | null>(`/api/products/${itemCode}`)
  }

  async getTopProducts(limit = 20): Promise<Product[]> {
    return this.fetch<Product[]>(`/api/products/top?limit=${limit}`)
  }

  async getJourneys(filters?: FilterOptions): Promise<Journey[]> {
    const params = new URLSearchParams()
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, String(value))
      })
    }
    return this.fetch<Journey[]>(`/api/journeys?${params}`)
  }

  async getJourney(journeyCode: string): Promise<Journey | null> {
    return this.fetch<Journey | null>(`/api/journeys/${journeyCode}`)
  }

  async getVisits(journeyCode?: string): Promise<Visit[]> {
    const endpoint = journeyCode
      ? `/api/journeys/${journeyCode}/visits`
      : '/api/visits'
    return this.fetch<Visit[]>(endpoint)
  }

  async getVisit(visitId: string): Promise<Visit | null> {
    return this.fetch<Visit | null>(`/api/visits/${visitId}`)
  }

  async getTargets(filters?: FilterOptions): Promise<Target[]> {
    const params = new URLSearchParams()
    if (filters?.userCode) {
      params.append('userCode', filters.userCode)
    }
    return this.fetch<Target[]>(`/api/targets?${params}`)
  }

  async getTarget(targetCode: string): Promise<Target | null> {
    return this.fetch<Target | null>(`/api/targets/${targetCode}`)
  }
}

// Export singleton instance
// Switch to real API using Next.js API routes
export const dataService: IDataService = new APIDataService('')

// Export for testing/development
export { MockDataService, APIDataService }