import { APIEndpoint, APIKey } from '@/admin/components/api/APIManager'

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

  constructor(baseUrl: string = '/api/admin/api-management') {
    this.baseUrl = baseUrl
  }

  // Endpoint Management
  async getEndpoints(): Promise<APIEndpoint[]> {
    const response = await fetch(`${this.baseUrl}/endpoints`)
    if (!response.ok) {
      throw new Error('Failed to fetch API endpoints')
    }
    const result = await response.json()
    return result.data
  }

  async createEndpoint(endpointData: Partial<APIEndpoint>): Promise<APIEndpoint> {
    const response = await fetch(`${this.baseUrl}/endpoints`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(endpointData),
    })
    if (!response.ok) {
      throw new Error('Failed to create API endpoint')
    }
    const result = await response.json()
    return result.data
  }

  async updateEndpoint(id: string, endpointData: Partial<APIEndpoint>): Promise<APIEndpoint> {
    const response = await fetch(`${this.baseUrl}/endpoints/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(endpointData),
    })
    if (!response.ok) {
      throw new Error('Failed to update API endpoint')
    }
    const result = await response.json()
    return result.data
  }

  async deleteEndpoint(id: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/endpoints/${id}`, {
      method: 'DELETE',
    })
    if (!response.ok) {
      throw new Error('Failed to delete API endpoint')
    }
  }

  async toggleEndpoint(id: string): Promise<APIEndpoint> {
    const response = await fetch(`${this.baseUrl}/endpoints/${id}/toggle`, {
      method: 'POST',
    })
    if (!response.ok) {
      throw new Error('Failed to toggle API endpoint')
    }
    const result = await response.json()
    return result.data
  }

  // API Key Management
  async getAPIKeys(): Promise<APIKey[]> {
    const response = await fetch(`${this.baseUrl}/keys`)
    if (!response.ok) {
      throw new Error('Failed to fetch API keys')
    }
    const result = await response.json()
    return result.data
  }

  async createAPIKey(keyData: Partial<APIKey>): Promise<APIKey & { fullKey: string }> {
    const response = await fetch(`${this.baseUrl}/keys`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(keyData),
    })
    if (!response.ok) {
      throw new Error('Failed to create API key')
    }
    const result = await response.json()
    return result.data
  }

  async updateAPIKey(id: string, keyData: Partial<APIKey>): Promise<APIKey> {
    const response = await fetch(`${this.baseUrl}/keys/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(keyData),
    })
    if (!response.ok) {
      throw new Error('Failed to update API key')
    }
    const result = await response.json()
    return result.data
  }

  async deleteAPIKey(id: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/keys/${id}`, {
      method: 'DELETE',
    })
    if (!response.ok) {
      throw new Error('Failed to delete API key')
    }
  }

  async revokeAPIKey(id: string): Promise<APIKey> {
    const response = await fetch(`${this.baseUrl}/keys/${id}/revoke`, {
      method: 'POST',
    })
    if (!response.ok) {
      throw new Error('Failed to revoke API key')
    }
    const result = await response.json()
    return result.data
  }

  // Analytics
  async getAnalytics(timeRange: string = '7d', endpoint?: string): Promise<APIAnalytics> {
    const params = new URLSearchParams({ timeRange })
    if (endpoint) params.append('endpoint', endpoint)
    
    const response = await fetch(`${this.baseUrl}/analytics?${params}`)
    if (!response.ok) {
      throw new Error('Failed to fetch API analytics')
    }
    const result = await response.json()
    return result.data
  }

  async getEndpointMetrics(endpointId: string, timeRange: string = '24h'): Promise<any> {
    const response = await fetch(`${this.baseUrl}/endpoints/${endpointId}/metrics?timeRange=${timeRange}`)
    if (!response.ok) {
      throw new Error('Failed to fetch endpoint metrics')
    }
    const result = await response.json()
    return result.data
  }

  // Rate Limiting
  async updateRateLimit(endpointId: string, rateLimitConfig: RateLimitConfig): Promise<void> {
    const response = await fetch(`${this.baseUrl}/endpoints/${endpointId}/rate-limit`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(rateLimitConfig),
    })
    if (!response.ok) {
      throw new Error('Failed to update rate limit')
    }
  }

  async getRateLimitStatus(userId?: string, apiKey?: string): Promise<any> {
    const params = new URLSearchParams()
    if (userId) params.append('userId', userId)
    if (apiKey) params.append('apiKey', apiKey)
    
    const response = await fetch(`${this.baseUrl}/rate-limit/status?${params}`)
    if (!response.ok) {
      throw new Error('Failed to fetch rate limit status')
    }
    const result = await response.json()
    return result.data
  }

  // Documentation
  async getDocumentation(endpoint?: string): Promise<APIDocumentation[]> {
    const params = endpoint ? `?endpoint=${endpoint}` : ''
    const response = await fetch(`${this.baseUrl}/documentation${params}`)
    if (!response.ok) {
      throw new Error('Failed to fetch API documentation')
    }
    const result = await response.json()
    return result.data
  }

  async updateDocumentation(endpoint: string, documentation: Partial<APIDocumentation>): Promise<APIDocumentation> {
    const response = await fetch(`${this.baseUrl}/documentation/${endpoint}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(documentation),
    })
    if (!response.ok) {
      throw new Error('Failed to update API documentation')
    }
    const result = await response.json()
    return result.data
  }

  async generateDocumentation(): Promise<void> {
    const response = await fetch(`${this.baseUrl}/documentation/generate`, {
      method: 'POST',
    })
    if (!response.ok) {
      throw new Error('Failed to generate API documentation')
    }
  }

  // Health Monitoring
  async getHealthStatus(): Promise<any> {
    const response = await fetch(`${this.baseUrl}/health`)
    if (!response.ok) {
      throw new Error('Failed to fetch API health status')
    }
    const result = await response.json()
    return result.data
  }

  async runHealthCheck(endpoint?: string): Promise<any> {
    const params = endpoint ? `?endpoint=${endpoint}` : ''
    const response = await fetch(`${this.baseUrl}/health/check${params}`, {
      method: 'POST',
    })
    if (!response.ok) {
      throw new Error('Failed to run health check')
    }
    const result = await response.json()
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