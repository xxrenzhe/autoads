import request from '@/utils/request'

export const tokenApi = {
  getBalance(userId) { return request({ url: `/api/v1/admin/tokens/balance/${userId}`, method: 'get' }) },
  adjust(userId, data) { return request({ url: `/api/v1/admin/tokens/adjust/${userId}`, method: 'post', data }) },
  listTx(params = {}) { return request({ url: '/api/v1/admin/tokens/transactions', method: 'get', params }) }
}

