import type { APIEndpoint, APIKey } from '@/admin/components/api/APIManager'
import { robustFetch } from '@/lib/utils/api/robust-client'

export interface APIAnalytics {
  summary: {
    totalRequests: number
    totalErrors: number
    errorRate: string
    averageResponseTime: number
    uniqueUsers: number
    activeApiKeys: number
  }
  dailyData: Array<{
    date: string
    requests: number
    errors: number
    averageResponseTime: number
    uniqueUsers: number
  }>
  endpointPerformance: Array<{
    endpoint: string
    requests: number
    errors: number
    averageResponseTime: number
    successRate: number
    p95ResponseTime: number
    p99ResponseTime: number
  }>
  errorBreakdown: Array<{
    type: string
    count: number
    percentage: number
  }>
  topUsers: Array<{
    userId: string
    email: string
    requests: number
    errors: number
  }>
  rateLimitViolations: Array<{
    timestamp: string
    userId: string
    endpoint: string
    attempts: number
    limit: number
  }>
  responseTimeDistribution: Record<string, number>
  geographicDistribution: Array<{
    country: string
    requests: number
    percentage: number
  }>
}

export interface RateLimitConfig {
  endpoint: string
  method: string
  perMinute: number
  perHour: number
  perDay?: number
  burstLimit?: number
}

export interface APIDocumentation {
  endpoint: string
  method: string
  description: string
  parameters: Array<{
    name: string
    type: string
    required: boolean
    description: string
    example?: any
  }>
  responses: Array<{
    status: number
    description: string
    example?: any
  }>
  examples: Array<{
    title: string
    request: any
    response: any
  }>
  authentication: {
    required: boolean
    type: string
    description: string
  }
  rateLimit: RateLimitConfig
}

export class APIManagementService {
  private baseUrl: string

  constructor(baseUrl: string = '/ops/api/v1/console/api-management') {
    this.baseUrl = baseUrl
  }

  private async requestJson<T = any>(url: string, init?: RequestInit): Promise<T> {
    const res = await robustFetch(url, {
      ...init,
      headers: {
        'Accept': 'application/json',
        ...(init?.headers || {})
      }
    });
    if (!res.ok) {
      const msg = `${res.status} ${res.statusText}`
      throw new Error(`API request failed: ${msg}`)
    }
    return res.json() as Promise<T>;
  }

  // Endpoint Management
  async getEndpoints(): Promise<APIEndpoint[]> {
    const result = await this.requestJson(`${this.baseUrl}/endpoints`)
    return result.data
  }

  async createEndpoint(endpointData: Partial<APIEndpoint>): Promise<APIEndpoint> {
    const result = await this.requestJson(`${this.baseUrl}/endpoints`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(endpointData)
    })
    return result.data
  }

  async updateEndpoint(id: string, endpointData: Partial<APIEndpoint>): Promise<APIEndpoint> {
    const result = await this.requestJson(`${this.baseUrl}/endpoints/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(endpointData)
    })
    return result.data
  }

  async deleteEndpoint(id: string): Promise<void> {
    await this.requestJson(`${this.baseUrl}/endpoints/${id}`, { method: 'DELETE' })
  }

  async toggleEndpoint(id: string): Promise<APIEndpoint> {
    const result = await this.requestJson(`${this.baseUrl}/endpoints/${id}/toggle`, { method: 'POST' })
    return result.data
  }

  // API Key Management
  async getAPIKeys(): Promise<APIKey[]> {
    const result = await this.requestJson(`${this.baseUrl}/keys`)
    return result.data
  }

  async createAPIKey(keyData: Partial<APIKey>): Promise<APIKey & { fullKey: string }> {
    const result = await this.requestJson(`${this.baseUrl}/keys`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(keyData)
    })
    return result.data
  }

  async updateAPIKey(id: string, keyData: Partial<APIKey>): Promise<APIKey> {
    const result = await this.requestJson(`${this.baseUrl}/keys/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(keyData)
    })
    return result.data
  }

  async deleteAPIKey(id: string): Promise<void> {
    await this.requestJson(`${this.baseUrl}/keys/${id}`, { method: 'DELETE' })
  }

  async revokeAPIKey(id: string): Promise<APIKey> {
    const result = await this.requestJson(`${this.baseUrl}/keys/${id}/revoke`, { method: 'POST' })
    return result.data
  }

  // Analytics
  async getAnalytics(timeRange: string = '7d', endpoint?: string): Promise<APIAnalytics> {
    const params = new URLSearchParams({ timeRange })
    if (endpoint) params.append('endpoint', endpoint)
    
    const result = await this.requestJson(`${this.baseUrl}/analytics?${params}`)
    return result.data
  }

  async getEndpointMetrics(endpointId: string, timeRange: string = '24h'): Promise<any> {
    const result = await this.requestJson(`${this.baseUrl}/endpoints/${endpointId}/metrics?timeRange=${timeRange}`)
    return result.data
  }

  // Rate Limiting
  async updateRateLimit(endpointId: string, rateLimitConfig: RateLimitConfig): Promise<void> {
    await this.requestJson(`${this.baseUrl}/endpoints/${endpointId}/rate-limit`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rateLimitConfig)
    })
  }

  async getRateLimitStatus(userId?: string, apiKey?: string): Promise<any> {
    const params = new URLSearchParams()
    if (userId) params.append('userId', userId)
    if (apiKey) params.append('apiKey', apiKey)
    
    const result = await this.requestJson(`${this.baseUrl}/rate-limit/status?${params}`)
    return result.data
  }

  // Documentation
  async getDocumentation(endpoint?: string): Promise<APIDocumentation[]> {
    const params = endpoint ? `?endpoint=${endpoint}` : ''
    const result = await this.requestJson(`${this.baseUrl}/documentation${params}`)
    return result.data
  }

  async updateDocumentation(endpoint: string, documentation: Partial<APIDocumentation>): Promise<APIDocumentation> {
    const result = await this.requestJson(`${this.baseUrl}/documentation/${endpoint}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(documentation)
    })
    return result.data
  }

  async generateDocumentation(): Promise<void> {
    await this.requestJson(`${this.baseUrl}/documentation/generate`, { method: 'POST' })
  }

  // Health Monitoring
  async getHealthStatus(): Promise<any> {
    const result = await this.requestJson(`${this.baseUrl}/health`)
    return result.data
  }

  async runHealthCheck(endpoint?: string): Promise<any> {
    const params = endpoint ? `?endpoint=${endpoint}` : ''
    const result = await this.requestJson(`${this.baseUrl}/health/check${params}`, { method: 'POST' })
    return result.data
  }

  // Utility Methods
  formatNumber(num: number): string {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
    return num.toString()
  }

  formatResponseTime(ms: number): string {
    if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`
    return `${ms}ms`
  }

  getStatusColor(successRate: number): string {
    if (successRate >= 95) return 'text-green-600'
    if (successRate >= 90) return 'text-yellow-600'
    return 'text-red-600'
  }

  calculateSuccessRate(totalRequests: number, errorCount: number): number {
    if (totalRequests === 0) return 100
    return ((totalRequests - errorCount) / totalRequests) * 100
  }

  validateAPIKey(key: string): boolean {
    // Basic API key format validation
    const apiKeyPattern = /^ak_[a-zA-Z0-9]{10,}_[a-zA-Z0-9]{32,}$/
    return apiKeyPattern.test(key)
  }

  validateEndpointPath(path: string): boolean {
    // Basic endpoint path validation
    return path.startsWith('/api/') && path.length > 5
  }

  validateRateLimit(config: RateLimitConfig): string[] {
    const errors: string[] = []
    
    if (config.perMinute <= 0) {
      errors.push('Per-minute rate limit must be greater than 0')
    }
    
    if (config.perHour <= 0) {
      errors.push('Per-hour rate limit must be greater than 0')
    }
    
    if (config.perMinute > config.perHour) {
      errors.push('Per-minute limit cannot exceed per-hour limit')
    }
    
    if (config.burstLimit && config.burstLimit < config.perMinute) {
      errors.push('Burst limit cannot be less than per-minute limit')
    }
    
    return errors
  }
}

export const apiManagementService = new APIManagementService()
