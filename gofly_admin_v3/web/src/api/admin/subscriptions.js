import request from '@/utils/request'

export const subsApi = {
  // Plans
  listPlans(params = {}) { return request({ url: '/ops/api/v1/console/plans', method: 'get', params }) },
  createPlan(data) { return request({ url: '/ops/api/v1/console/plans', method: 'post', data }) },
  updatePlan(id, data) { return request({ url: `/ops/api/v1/console/plans/${id}`, method: 'put', data }) },
  deletePlan(id) { return request({ url: `/ops/api/v1/console/plans/${id}`, method: 'delete' }) },

  // User subscriptions
  listUserSubs(userId) { return request({ url: `/ops/api/v1/console/users/${userId}/subscriptions`, method: 'get' }) },
  assign(userId, data) { return request({ url: `/ops/api/v1/console/users/${userId}/subscriptions/assign`, method: 'post', data }) },
  cancel(userId, subId) { return request({ url: `/ops/api/v1/console/users/${userId}/subscriptions/${subId}/cancel`, method: 'post' }) }
}
