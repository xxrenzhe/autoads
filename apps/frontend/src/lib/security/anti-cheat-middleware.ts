import { NextRequest, NextResponse } from 'next/server'
import { IPRateLimitManager } from './ip-rate-limit'
import { prisma } from '@/lib/db'

// 防作弊配置
const ANTI_CHEAT_CONFIG = {
  // IP限制：同一IP每小时最多创建3个账号
  IP_SIGNUP_LIMIT: {
    windowMs: 60 * 60 * 1000, // 1小时
    maxRequests: 3,
  },
  // 设备限制：同一设备每天最多创建2个账号
  DEVICE_SIGNUP_LIMIT: {
    windowMs: 24 * 60 * 60 * 1000, // 24小时
    maxRequests: 2,
  },
  // 新账号功能限制（防作弊）
  NEW_ACCOUNT_LIMITS: {
    // 新账号前24小时不能签到（防止立即刷币）
    noCheckInHours: 24,
  }
} as const

// 设备指纹生成（简单版）
function generateSimpleDeviceFingerprint(request: NextRequest): string {
  const userAgent = request.headers.get('user-agent') || ''
  const acceptLanguage = request.headers.get('accept-language') || ''
  const acceptEncoding = request.headers.get('accept-encoding') || ''
  
  // 简单的hash算法
  const data = `${userAgent}|${acceptLanguage}|${acceptEncoding}`
  let hash = 0
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // 转换为32位整数
  }
  
  return Math.abs(hash).toString(36)
}

// 创建速率限制管理器实例
const ipRateLimitManager = new IPRateLimitManager(ANTI_CHEAT_CONFIG.IP_SIGNUP_LIMIT)

/**
 * 防作弊中间件
 */
export async function antiCheatMiddleware(request: NextRequest): Promise<{
  allowed: boolean
  reason?: string
  deviceFingerprint?: string
}> {
  try {
    const ip = request.ip || request.headers.get('x-forwarded-for') || 'unknown'
    const deviceFingerprint = generateSimpleDeviceFingerprint(request)
    const url = new URL(request.url)
    const pathname = url.pathname
    
    // 1. 检查 OAuth 回调的 IP 频率
    if (pathname === '/api/auth/callback/google') {
      const rateLimitResult = await ipRateLimitManager.checkRateLimit(ip, pathname)
      
      if (!rateLimitResult.allowed) {
        return {
          allowed: false,
          reason: 'IP注册频率超限'
        }
      }
    }
    
    // 2. 检查设备频率（针对新用户注册）
    if (pathname.includes('/api/auth/') && request.method === 'POST') {
      const deviceKey = `device_signup:${deviceFingerprint}`
      const deviceSignups = await prisma.user.count({
        where: {
          devices: {
            some: {
              fingerprint: deviceFingerprint,
              createdAt: {
                gte: new Date(Date.now() - ANTI_CHEAT_CONFIG.DEVICE_SIGNUP_LIMIT.windowMs)
              }
            }
          }
        }
      })
      
      if (deviceSignups >= ANTI_CHEAT_CONFIG.DEVICE_SIGNUP_LIMIT.maxRequests) {
        return {
          allowed: false,
          reason: '设备注册频率超限'
        }
      }
    }
    
    // 3. 记录设备信息（在用户创建后）
    if (pathname === '/api/auth/session' && request.method === 'GET') {
      // 这里会在用户认证成功后记录设备
      return {
        allowed: true,
        deviceFingerprint
      }
    }
    
    return {
      allowed: true,
      deviceFingerprint
    }
    
  } catch (error) {
    console.error('防作弊检查失败:', error)
    // 出错时默认允许，避免误拦
    return { allowed: true }
  }
}

/**
 * 记录用户设备信息
 */
export async function recordUserDevice(userId: string, deviceFingerprint: string, request: NextRequest) {
  try {
    const userAgent = request.headers.get('user-agent') || ''
    const ip = request.ip || request.headers.get('x-forwarded-for') || 'unknown'
    
    // 检查设备是否已存在
    const existingDevice = await prisma.userDevice.findFirst({
      where: {
        userId,
        fingerprint: deviceFingerprint
      }
    })
    
    if (existingDevice) {
      // 更新最后使用时间
      await prisma.userDevice.update({
        where: { id: existingDevice.id },
        data: {
          lastSeenAt: new Date(),
          lastIP: ip
        }
      })
    } else {
      // 创建新设备记录
      await prisma.userDevice.create({
        data: {
          userId,
          fingerprint: deviceFingerprint,
          userAgent,
          firstIP: ip,
          lastIP: ip,
          firstSeenAt: new Date(),
          lastSeenAt: new Date()
        }
      })
    }
  } catch (error) {
    console.error('记录设备信息失败:', error)
  }
}

/**
 * 检查新账号限制
 */
export async function checkNewAccountLimits(userId: string, action: 'check-in' | 'api' | 'purchase' = 'check-in'): Promise<{
  allowed: boolean
  reason?: string
}> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        createdAt: true,
        tokenBalance: true
      }
    })
    
    if (!user) {
      return { allowed: false, reason: '用户不存在' }
    }
    
    // 检查是否为新账号（24小时内）
    const accountAgeMs = Date.now() - user.createdAt.getTime()
    const isNewAccount = accountAgeMs < 24 * 60 * 60 * 1000
    
    if (!isNewAccount) {
      return { allowed: true }
    }
    
    // 新账号限制
    const { NEW_ACCOUNT_LIMITS } = ANTI_CHEAT_CONFIG
    
    // 根据不同动作检查不同限制
    switch (action) {
      case 'check-in':
        // 前3小时不能签到
        if (accountAgeMs < NEW_ACCOUNT_LIMITS.noCheckInHours * 60 * 60 * 1000) {
          return {
            allowed: false,
            reason: `新账号需要等待${NEW_ACCOUNT_LIMITS.noCheckInHours}小时后才能签到`
          }
        }
        break
        
      case 'api':
        // API调用不设限制，用户可以根据套餐自由使用
        // token消耗机制本身就会限制滥用
        break
        
      case 'purchase':
        // Token购买不设上限，用户可以自由购买
        // 购买是平台的收入来源，不应该限制
        break
    }
    
    return { allowed: true }
    
  } catch (error) {
    console.error('检查新账号限制失败:', error)
    return { allowed: true }
  }
}