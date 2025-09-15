// GoFly Admin - API管理（端点与API Key）

import request from '@/utils/request'

export const apiMgmt = {
  // Endpoints
  listEndpoints(params = {}) {
    return request({ url: '/ops/api/v1/console/api-management/endpoints', method: 'get', params })
  },
  createEndpoint(data) {
    return request({ url: '/ops/api/v1/console/api-management/endpoints', method: 'post', data })
  },
  updateEndpoint(id, data) {
    return request({ url: `/ops/api/v1/console/api-management/endpoints/${id}`, method: 'put', data })
  },
  deleteEndpoint(id) {
    return request({ url: `/ops/api/v1/console/api-management/endpoints/${id}`, method: 'delete' })
  },
  toggleEndpoint(id) {
    return request({ url: `/ops/api/v1/console/api-management/endpoints/${id}/toggle`, method: 'post' })
  },
  getEndpointMetrics(id, params = {}) {
    return request({ url: `/api/v1/admin/api-management/endpoints/${id}/metrics`, method: 'get', params })
  },

  // API Keys
  listKeys(params = {}) {
    return request({ url: '/ops/api/v1/console/api-management/keys', method: 'get', params })
  },
  createKey(data) {
    return request({ url: '/ops/api/v1/console/api-management/keys', method: 'post', data })
  },
  updateKey(id, data) {
    return request({ url: `/ops/api/v1/console/api-management/keys/${id}`, method: 'put', data })
  },
  deleteKey(id) {
    return request({ url: `/ops/api/v1/console/api-management/keys/${id}`, method: 'delete' })
  },
  revokeKey(id) {
    return request({ url: `/ops/api/v1/console/api-management/keys/${id}/revoke`, method: 'post' })
  },

  // Analytics & Performance
  getAnalytics(params = {}) {
    return request({ url: '/ops/api/v1/console/api-management/analytics', method: 'get', params })
  },
  getPerformance(params = {}) {
    return request({ url: '/ops/api/v1/console/api-management/performance', method: 'get', params })
  }
}
