import request from '@/utils/request'

export const adminsApi = {
  list() { return request({ url: '/api/v1/admin/admins', method: 'get' }) },
  create(data) { return request({ url: '/api/v1/admin/admins', method: 'post', data }) },
  update(id, data) { return request({ url: `/api/v1/admin/admins/${id}`, method: 'put', data }) },
  remove(id) { return request({ url: `/api/v1/admin/admins/${id}`, method: 'delete' }) },
  resetPassword(id, password) { return request({ url: `/api/v1/admin/admins/${id}/password`, method: 'put', data: { password } }) },
  roles() { return request({ url: '/api/v1/admin/roles', method: 'get' }) }
}

