import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/v5-config';
import { prisma } from '@/lib/prisma';
import { Logger } from '@/lib/core/Logger';

const logger = new Logger('API-DOCUMENTATION');

/**
 * Get comprehensive API documentation and status
 */
export async function GET(request: NextRequest) {
  try {
    // Check admin authentication
    const session = await auth();
    
    if (!session?.userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { role: true }
    });
    
    if (!user || !['ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Define system APIs with their documentation
    const systemApis = [
      // Authentication APIs
      {
        id: 'auth-signin',
        path: '/api/auth/signin',
        method: 'POST',
        category: 'auth',
        description: '用户登录接口',
        authentication: 'none',
        parameters: [
          { name: 'email', type: 'string', required: true, description: '用户邮箱' },
          { name: 'password', type: 'string', required: true, description: '用户密码' },
        ],
        responses: [
          { status: 200, description: '登录成功', example: { success: true, user: { id: 'user_id', email: 'user@example.com' } } },
          { status: 401, description: '认证失败', example: { error: 'Invalid credentials' } },
        ],
        examples: [
          {
            title: '用户登录',
            request: { email: 'user@example.com', password: 'password123' },
            response: { success: true, user: { id: 'user_123', email: 'user@example.com', name: 'John Doe' } }
          }
        ],
        status: 'active',
        version: 'v1',
        lastModified: new Date().toISOString(),
      },
      {
        id: 'auth-signout',
        path: '/api/auth/signout',
        method: 'POST',
        category: 'auth',
        description: '用户登出接口',
        authentication: 'session',
        parameters: [],
        responses: [
          { status: 200, description: '登出成功', example: { success: true } },
        ],
        examples: [
          {
            title: '用户登出',
            request: {},
            response: { success: true, message: 'Signed out successfully' }
          }
        ],
        status: 'active',
        version: 'v1',
        lastModified: new Date().toISOString(),
      },

      // Admin APIs
      {
        id: 'admin-dashboard-stats',
        path: '/api/admin/dashboard/stats',
        method: 'GET',
        category: 'admin',
        description: '获取管理员仪表板统计数据',
        authentication: 'admin',
        parameters: [],
        responses: [
          { status: 200, description: '统计数据获取成功', example: { success: true, data: { totalUsers: 1000, activeSubscriptions: 250 } } },
          { status: 401, description: '未授权访问', example: { error: 'Unauthorized' } },
        ],
        examples: [
          {
            title: '获取仪表板统计',
            request: {},
            response: {
              success: true,
              data: {
                totalUsers: 1000,
                activeSubscriptions: 250,
                monthlyRevenue: 5000,
                trialUsers: 50
              }
            }
          }
        ],
        status: 'active',
        version: 'v1',
        lastModified: new Date().toISOString(),
      },
      {
        id: 'admin-tokens-rules',
        path: '/api/admin/tokens/rules',
        method: 'GET',
        category: 'admin',
        description: '获取Token消费规则列表',
        authentication: 'admin',
        parameters: [],
        responses: [
          { status: 200, description: '规则列表获取成功' },
          { status: 401, description: '未授权访问' },
        ],
        examples: [
          {
            title: '获取Token规则',
            request: {},
            response: {
              success: true,
              data: [
                { id: 'siterank-default', feature: 'siterank', method: 'default', cost: 1 }
              ]
            }
          }
        ],
        status: 'active',
        version: 'v1',
        lastModified: new Date().toISOString(),
      },

      // User APIs
      {
        id: 'user-profile',
        path: '/api/user/profile',
        method: 'GET',
        category: 'user',
        description: '获取用户个人资料',
        authentication: 'session',
        parameters: [],
        responses: [
          { status: 200, description: '用户资料获取成功' },
          { status: 401, description: '未登录' },
        ],
        examples: [
          {
            title: '获取用户资料',
            request: {},
            response: {
              success: true,
              user: {
                id: 'user_123',
                email: 'user@example.com',
                name: 'John Doe',
                tokenBalance: 100
              }
            }
          }
        ],
        status: 'active',
        version: 'v1',
        lastModified: new Date().toISOString(),
      },
      {
        id: 'user-trial-status',
        path: '/api/user/trial-status',
        method: 'GET',
        category: 'user',
        description: '获取用户试用状态',
        authentication: 'session',
        parameters: [],
        responses: [
          { status: 200, description: '试用状态获取成功' },
          { status: 401, description: '未登录' },
        ],
        examples: [
          {
            title: '获取试用状态',
            request: {},
            response: {
              success: true,
              data: {
                isOnTrial: true,
                daysRemaining: 10,
                expiresAt: '2024-01-15T00:00:00Z'
              }
            }
          }
        ],
        status: 'active',
        version: 'v1',
        lastModified: new Date().toISOString(),
      },

      // Payment APIs
      {
        id: 'payment-create-subscription',
        path: '/api/payment/subscription',
        method: 'POST',
        category: 'payment',
        description: '创建订阅支付',
        authentication: 'session',
        parameters: [
          { name: 'planId', type: 'string', required: true, description: '订阅计划ID' },
          { name: 'billingCycle', type: 'string', required: false, description: '计费周期 (monthly/yearly)' },
        ],
        responses: [
          { status: 200, description: '支付创建成功' },
          { status: 400, description: '参数错误' },
          { status: 401, description: '未登录' },
        ],
        examples: [
          {
            title: '创建月度订阅',
            request: { planId: 'plan_pro', billingCycle: 'monthly' },
            response: {
              success: true,
              data: {
                subscriptionId: 'sub_123',
                paymentUrl: 'https://checkout.stripe.com/...'
              }
            }
          }
        ],
        status: 'active',
        version: 'v1',
        lastModified: new Date().toISOString(),
      },

      // Core Feature APIs
      {
        id: 'core-siterank',
        path: '/api/siterank',
        method: 'POST',
        category: 'core',
        description: 'SiteRank网站排名查询',
        authentication: 'session',
        parameters: [
          { name: 'url', type: 'string', required: true, description: '要查询的网站URL' },
          { name: 'keywords', type: 'array', required: false, description: '关键词列表' },
        ],
        responses: [
          { status: 200, description: '查询成功' },
          { status: 400, description: '参数错误' },
          { status: 401, description: '未登录' },
          { status: 402, description: 'Token不足' },
        ],
        examples: [
          {
            title: '查询网站排名',
            request: { url: 'https://example.com', keywords: ['keyword1', 'keyword2'] },
            response: {
              success: true,
              data: {
                url: 'https://example.com',
                rank: 15,
                keywords: [
                  { keyword: 'keyword1', position: 12 },
                  { keyword: 'keyword2', position: 18 }
                ]
              }
            }
          }
        ],
        status: 'active',
        version: 'v1',
        lastModified: new Date().toISOString(),
      },
      {
        id: 'core-batchopen',
        path: '/api/batchopen',
        method: 'POST',
        category: 'core',
        description: 'BatchOpen批量网页打开',
        authentication: 'session',
        parameters: [
          { name: 'urls', type: 'array', required: true, description: '要打开的URL列表' },
          { name: 'method', type: 'string', required: false, description: '打开方式 (http/puppeteer)' },
        ],
        responses: [
          { status: 200, description: '批量打开成功' },
          { status: 400, description: '参数错误' },
          { status: 401, description: '未登录' },
          { status: 402, description: 'Token不足' },
        ],
        examples: [
          {
            title: '批量打开网页',
            request: { urls: ['https://example1.com', 'https://example2.com'], method: 'http' },
            response: {
              success: true,
              data: {
                batchId: 'batch_123',
                results: [
                  { url: 'https://example1.com', status: 'success', statusCode: 200 },
                  { url: 'https://example2.com', status: 'success', statusCode: 200 }
                ]
              }
            }
          }
        ],
        status: 'active',
        version: 'v1',
        lastModified: new Date().toISOString(),
      },
    ];

    // Get usage statistics for each API from database
    const apisWithStats = await Promise.all(
      systemApis.map(async (api) => {
        // Get 24h usage from API access logs
        const twentyFourHoursAgo = new Date();
        twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

        const usage24h = await prisma.apiAccessLog.count({
          where: {
            endpoint: api.path,
            method: api.method.toUpperCase(),
            createdAt: {
              gte: twentyFourHoursAgo,
            },
          },
        });

        // Get total usage
        const usageTotal = await prisma.apiAccessLog.count({
          where: {
            endpoint: api.path,
            method: api.method.toUpperCase(),
          },
        });

        // Get average response time
        const avgResponseTime = await prisma.apiAccessLog.aggregate({
          where: {
            endpoint: api.path,
            method: api.method.toUpperCase(),
            createdAt: {
              gte: twentyFourHoursAgo,
            },
          },
          _avg: {
            duration: true,
          },
        });

        // Calculate error rate
        const errorCount = await prisma.apiAccessLog.count({
          where: {
            endpoint: api.path,
            method: api.method.toUpperCase(),
            statusCode: {
              gte: 400,
            },
            createdAt: {
              gte: twentyFourHoursAgo,
            },
          },
        });

        const errorRate = usage24h > 0 ? errorCount / usage24h : 0;

        return {
          ...api,
          usage24h,
          usageTotal,
          avgResponseTime: Math.round((avgResponseTime._avg as any)?.duration || 0),
          errorRate,
        };
      })
    );

    return NextResponse.json({
      success: true,
      data: apisWithStats,
      metadata: {
        totalApis: apisWithStats.length,
        categories: {
          auth: apisWithStats.filter(api => api.category === 'auth').length,
          admin: apisWithStats.filter(api => api.category === 'admin').length,
          user: apisWithStats.filter(api => api.category === 'user').length,
          payment: apisWithStats.filter(api => api.category === 'payment').length,
          core: apisWithStats.filter(api => api.category === 'core').length,
        },
        statusDistribution: {
          active: apisWithStats.filter(api => api.status === 'active').length,
          deprecated: apisWithStats.filter(api => api.status === 'deprecated').length,
          beta: apisWithStats.filter(api => api.status === 'beta').length,
          maintenance: apisWithStats.filter(api => api.status === 'maintenance').length,
        },
      },
    });

  } catch (error) {
    logger.error('Failed to get API documentation:', error as any);
    
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get API documentation',
        message: error instanceof Error ? error.message : "Unknown error" as any,
      },
      { status: 500 }
    );
  }
}