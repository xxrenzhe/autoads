import { configService } from './config-service'
import { prisma } from '@/lib/db'

interface SimilarWebConfig {
  apiKey: string
  baseUrl: string
  enabled: boolean
  rateLimit: {
    requestsPerMonth: number
    requestsPerDay: number
    requestsPerHour: number
  }
  endpoints: {
    websiteOverview: boolean
    trafficAndEngagement: boolean
    audienceInterests: boolean
    competitorAnalysis: boolean
  }
}

interface ApiCallOptions {
  endpoint: string
  method?: 'GET' | 'POST'
  params?: Record<string, string>
  body?: any
}

class SimilarWebService {
  private async getConfig(): Promise<SimilarWebConfig> {
    const config = await configService.get('similarweb_api')

    if (!config || !config.enabled) {
      throw new Error('SimilarWeb API is not configured or enabled')
    }

    if (!config.apiKey) {
      throw new Error('SimilarWeb API key is not configured')
    }

    return config
  }

  private async checkRateLimit(): Promise<void> {
    const config = await this.getConfig()
    const usage = (await configService.get('similarweb_usage')) || {
      monthly: 0,
      daily: 0,
      hourly: 0,
      lastReset: {
        monthly: new Date().toISOString(),
        daily: new Date().toISOString(),
        hourly: new Date().toISOString()
      }
    }

    const now = new Date()

    // Reset counters if needed
    const lastResetHour = new Date(usage.lastReset.hourly)
    const lastResetDay = new Date(usage.lastReset.daily)
    const lastResetMonth = new Date(usage.lastReset.monthly)

    if (now.getTime() - lastResetHour.getTime() >= 3600000) { // 1 hour
      usage.hourly = 0
      usage.lastReset.hourly = now.toISOString()
    }

    if (now.getDate() !== lastResetDay.getDate()) {
      usage.daily = 0
      usage.lastReset.daily = now.toISOString()
    }

    if (now.getMonth() !== lastResetMonth.getMonth()) {
      usage.monthly = 0
      usage.lastReset.monthly = now.toISOString()
    }

    // Check limits
    if (usage.hourly >= config.rateLimit.requestsPerHour) {
      throw new Error('Hourly rate limit exceeded')
    }

    if (usage.daily >= config.rateLimit.requestsPerDay) {
      throw new Error('Daily rate limit exceeded')
    }

    if (usage.monthly >= config.rateLimit.requestsPerMonth) {
      throw new Error('Monthly rate limit exceeded')
    }

    // Update usage
    usage.hourly++
    usage.daily++
    usage.monthly++

    await configService.set('similarweb_usage', 'system', usage)
  }

  private async makeApiCall(options: ApiCallOptions): Promise<any> {
    const config = await this.getConfig()

    // Check rate limits
    await this.checkRateLimit()

    const url = new URL(options.endpoint, config.baseUrl)

    // Add API key to params
    if (options.params) {
      Object.entries(options.params).forEach(([key, value]) => {
        url.searchParams.append(key, value)
      })
    }
    url.searchParams.append('api_key', config.apiKey)

    const startTime = Date.now()
    let response: Response
    let responseTime: number
    let statusCode: number

    try {
      response = await fetch(url.toString(), {
        method: options.method || 'GET',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'SimilarWeb-Integration/1.0'
        },
        body: options.body ? JSON.stringify(options.body) : undefined
      })

      responseTime = Date.now() - startTime
      statusCode = response.status

      // Log API call
      await this.logApiCall({
        endpoint: options.endpoint,
        method: options.method || 'GET',
        statusCode,
        responseTime,
        success: response.ok
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`SimilarWeb API error (${response.status}): ${errorText}`)
      }

      const data = await response.json()
      return data

    } catch (error) {
      responseTime = Date.now() - startTime
      statusCode = 0 // response?.status || 0 // response might be undefined

      // Log failed API call
      await this.logApiCall({
        endpoint: options.endpoint,
        method: options.method || 'GET',
        statusCode,
        responseTime,
        success: false,
        error: error instanceof Error ? error.message : "Unknown error" as any
      })

      throw error
    }
  }

  private async logApiCall(logData: {
    endpoint: string
    method: string
    statusCode: number
    responseTime: number
    success: boolean
    error?: string
  }): Promise<void> {
    try {
      await prisma.apiAccessLog.create({
        data: {
          endpoint: logData.endpoint,
          method: logData.method,
          statusCode: logData.statusCode,
          duration: logData.responseTime,
          ipAddress: '127.0.0.1', // Default IP for API calls
          userAgent: 'SimilarWeb-Service/1.0'
        }
      })
    } catch (error) {
      console.error('Failed to log SimilarWeb API call:', error)
    }
  }

  async testConnection(): Promise<{ status: string; timestamp: string }> {
    try {
      // Use a simple endpoint to test connectivity
      await this.makeApiCall({
        endpoint: '/v1/website/example.com/total-traffic-and-engagement/visits',
        params: {
          start_date: '2023-01',
          end_date: '2023-01',
          country: 'world',
          granularity: 'monthly',
          main_domain_only: 'false'
        }
      })

      return {
        status: 'connected',
        timestamp: new Date().toISOString()
      }
    } catch (error) {
      throw new Error(`Connection test failed: ${error instanceof Error ? error.message : "Unknown error" as any}`)
    }
  }

  async getWebsiteOverview(domain: string, options: {
    startDate?: string
    endDate?: string
    country?: string
  } = {}): Promise<any> {
    const config = await this.getConfig()

    if (!config.endpoints.websiteOverview) {
      throw new Error('Website Overview endpoint is not enabled')
    }

    return this.makeApiCall({
      endpoint: `/v1/website/${domain}/total-traffic-and-engagement/visits`,
      params: {
        start_date: options.startDate || '2023-01',
        end_date: options.endDate || '2023-12',
        country: options.country || 'world',
        granularity: 'monthly',
        main_domain_only: 'false'
      }
    })
  }

  async getTrafficAndEngagement(domain: string, options: {
    startDate?: string
    endDate?: string
    country?: string
    granularity?: 'daily' | 'weekly' | 'monthly'
  } = {}): Promise<any> {
    const config = await this.getConfig()

    if (!config.endpoints.trafficAndEngagement) {
      throw new Error('Traffic and Engagement endpoint is not enabled')
    }

    return this.makeApiCall({
      endpoint: `/v1/website/${domain}/total-traffic-and-engagement/visits`,
      params: {
        start_date: options.startDate || '2023-01',
        end_date: options.endDate || '2023-12',
        country: options.country || 'world',
        granularity: options.granularity || 'monthly',
        main_domain_only: 'false'
      }
    })
  }

  async getAudienceInterests(domain: string, options: {
    country?: string
  } = {}): Promise<any> {
    const config = await this.getConfig()

    if (!config.endpoints.audienceInterests) {
      throw new Error('Audience Interests endpoint is not enabled')
    }

    return this.makeApiCall({
      endpoint: `/v1/website/${domain}/audience-interests/also-visited`,
      params: {
        country: options.country || 'world'
      }
    })
  }

  async getCompetitorAnalysis(domain: string, options: {
    country?: string
    limit?: number
  } = {}): Promise<any> {
    const config = await this.getConfig()

    if (!config.endpoints.competitorAnalysis) {
      throw new Error('Competitor Analysis endpoint is not enabled')
    }

    return this.makeApiCall({
      endpoint: `/v1/website/${domain}/similar-sites/similarsites`,
      params: {
        country: options.country || 'world',
        limit: (options.limit || 10).toString()
      }
    })
  }

  async getTopPages(domain: string, options: {
    country?: string
    limit?: number
  } = {}): Promise<any> {
    return this.makeApiCall({
      endpoint: `/v1/website/${domain}/content/pages/top-pages`,
      params: {
        country: options.country || 'world',
        limit: (options.limit || 10).toString()
      }
    })
  }

  async getKeywords(domain: string, options: {
    country?: string
    limit?: number
  } = {}): Promise<any> {
    return this.makeApiCall({
      endpoint: `/v1/website/${domain}/search/organic-keywords`,
      params: {
        country: options.country || 'world',
        limit: (options.limit || 10).toString()
      }
    })
  }

  async getReferrals(domain: string, options: {
    country?: string
    limit?: number
  } = {}): Promise<any> {
    return this.makeApiCall({
      endpoint: `/v1/website/${domain}/referrals/top-referrals`,
      params: {
        country: options.country || 'world',
        limit: (options.limit || 10).toString()
      }
    })
  }

  async getUsageStats(): Promise<any> {
    const usage = (await configService.get('similarweb_usage')) || {
      monthly: 0,
      daily: 0,
      hourly: 0,
      lastReset: {
        monthly: new Date().toISOString(),
        daily: new Date().toISOString(),
        hourly: new Date().toISOString()
      }
    }

    const config = await this.getConfig()

    return {
      usage,
      limits: config.rateLimit,
      remaining: {
        monthly: config.rateLimit.requestsPerMonth - usage.monthly,
        daily: config.rateLimit.requestsPerDay - usage.daily,
        hourly: config.rateLimit.requestsPerHour - usage.hourly
      }
    }
  }

  // Health check method
  async healthCheck(): Promise<{ status: string; timestamp: string; error?: string }> {
    try {
      const result = await this.testConnection()
      return {
        status: 'healthy',
        timestamp: result.timestamp
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : "Unknown error" as any,
        timestamp: new Date().toISOString()
      }
    }
  }
}

export const similarWebService = new SimilarWebService()