import request from '@/utils/request'

export const usersApi = {
  list(params = {}) { return request({ url: '/api/v1/admin/users', method: 'get', params }) },
  get(id) { return request({ url: `/api/v1/admin/users/${id}`, method: 'get' }) },
  updateStatus(id, status) { return request({ url: `/api/v1/admin/users/${id}/status`, method: 'put', data: { status } }) }
}

