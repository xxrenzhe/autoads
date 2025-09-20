import request from '@/utils/request'

export const tokenApi = {
  getBalance(userId) { return request({ url: `/ops/api/v1/console/tokens/balance/${userId}`, method: 'get' }) },
  adjust(userId, data) { return request({ url: `/ops/api/v1/console/tokens/adjust/${userId}`, method: 'post', data }) },
  listTx(params = {}) { return request({ url: '/ops/api/v1/console/tokens/transactions', method: 'get', params }) }
}

export default tokenApi
