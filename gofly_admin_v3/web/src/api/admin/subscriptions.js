import request from '@/utils/request'

export const subsApi = {
  // Plans
  listPlans(params = {}) { return request({ url: '/api/v1/admin/plans', method: 'get', params }) },
  createPlan(data) { return request({ url: '/api/v1/admin/plans', method: 'post', data }) },
  updatePlan(id, data) { return request({ url: `/api/v1/admin/plans/${id}`, method: 'put', data }) },
  deletePlan(id) { return request({ url: `/api/v1/admin/plans/${id}`, method: 'delete' }) },

  // User subscriptions
  listUserSubs(userId) { return request({ url: `/api/v1/admin/users/${userId}/subscriptions`, method: 'get' }) },
  assign(userId, data) { return request({ url: `/api/v1/admin/users/${userId}/subscriptions/assign`, method: 'post', data }) },
  cancel(userId, subId) { return request({ url: `/api/v1/admin/users/${userId}/subscriptions/${subId}/cancel`, method: 'post' }) }
}

