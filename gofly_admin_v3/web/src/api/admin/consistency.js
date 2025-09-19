import request from '@/utils/request'

export const consistencyApi = {
  getOrphanReports(params) {
    return request({ url: '/api/v1/audit/consistency/orphans', method: 'get', params })
  }
}

