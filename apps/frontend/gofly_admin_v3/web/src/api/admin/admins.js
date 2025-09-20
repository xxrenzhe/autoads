import request from '@/utils/request'

export const adminsApi = {
  list() { return request({ url: '/ops/api/v1/console/admins', method: 'get' }) },
  create(data) { return request({ url: '/ops/api/v1/console/admins', method: 'post', data }) },
  update(id, data) { return request({ url: `/ops/api/v1/console/admins/${id}`, method: 'put', data }) },
  remove(id) { return request({ url: `/ops/api/v1/console/admins/${id}`, method: 'delete' }) },
  resetPassword(id, password) { return request({ url: `/ops/api/v1/console/admins/${id}/password`, method: 'put', data: { password } }) },
  roles() { return request({ url: '/ops/api/v1/console/roles', method: 'get' }) }
}
