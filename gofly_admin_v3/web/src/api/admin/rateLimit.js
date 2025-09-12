// 后台管理API - 速率限制相关

import request from '@/utils/request'

// 速率限制管理API
export const rateLimitApi = {
  // 获取套餐速率限制配置
  getPlanLimits() {
    return request({
      url: '/api/v1/admin/rate-limits/plan',
      method: 'get'
    })
  },

  // 更新套餐速率限制配置
  updatePlanLimit(plan, data) {
    return request({
      url: `/api/v1/admin/rate-limits/plan/${plan}`,
      method: 'put',
      data
    })
  },

  // 获取用户速率限制统计
  getUserStats(userId, params = {}) {
    return request({
      url: `/api/v1/admin/rate-limits/user/${userId}/stats`,
      method: 'get',
      params
    })
  },

  // 获取系统速率限制统计
  getSystemStats() {
    return request({
      url: '/api/v1/admin/rate-limits/system/stats',
      method: 'get'
    })
  },

  // 列出活跃的限流器
  getActiveLimiters(params = {}) {
    return request({
      url: '/api/v1/admin/rate-limits/active',
      method: 'get',
      params
    })
  },

  // 重置用户限流器
  resetUserLimiter(userId) {
    return request({
      url: `/api/v1/admin/rate-limits/user/${userId}/reset`,
      method: 'post'
    })
  },

  // 获取系统使用统计报告
  getUsageReport(params = {}) {
    return request({
      url: '/api/v1/admin/rate-limits/report/usage',
      method: 'get',
      params
    })
  },

  // 获取用户使用排行榜
  getTopUsers(feature, params = {}) {
    return request({
      url: `/api/v1/admin/rate-limits/report/top-users/${feature}`,
      method: 'get',
      params
    })
  }
}