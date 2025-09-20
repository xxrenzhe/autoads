import request from '@/utils/request'

export const usersApi = {
  list(params = {}) { return request({ url: '/ops/api/v1/console/users', method: 'get', params }) },
  get(id) { return request({ url: `/ops/api/v1/console/users/${id}`, method: 'get' }) },
  updateStatus(id, status) { return request({ url: `/ops/api/v1/console/users/${id}/status`, method: 'put', data: { status } }) }
}
