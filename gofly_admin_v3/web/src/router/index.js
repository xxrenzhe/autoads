import { createRouter, createWebHistory } from 'vue-router'

import Dashboard from '../views/admin/Dashboard.vue'
import ApiManager from '../views/admin/ApiManager.vue'
import ApiAnalytics from '../views/admin/ApiAnalytics.vue'
import RateLimitManager from '../views/admin/RateLimitManager.vue'
import SystemManager from '../views/admin/SystemManager.vue'
import UserList from '../views/admin/UserList.vue'
import PlanManager from '../views/admin/PlanManager.vue'
import UserSubscription from '../views/admin/UserSubscription.vue'
import TokenOverview from '../views/admin/TokenOverview.vue'
import TokenAdjust from '../views/admin/TokenAdjust.vue'
import TokenTransactions from '../views/admin/TokenTransactions.vue'
import AdminAccounts from '../views/admin/AdminAccounts.vue'
import Monitoring from '../views/admin/Monitoring.vue'

// 占位页面
const Placeholder = (name) => ({
  name,
  template: `<div style="padding:16px">${name} 页面建设中…</div>`
})

const routes = [
  { path: '/', redirect: '/console/dashboard' },
  { path: '/console/dashboard', component: Dashboard },

  { path: '/console/api-manager', component: ApiManager },
  { path: '/console/api-analytics', component: ApiAnalytics },

  { path: '/console/rate-limit', component: RateLimitManager },
  { path: '/console/system', component: SystemManager },

  { path: '/console/users', component: UserList },
  { path: '/console/plans', component: PlanManager },
  { path: '/console/user-subscriptions', component: UserSubscription },

  { path: '/console/tokens/overview', component: TokenOverview },
  { path: '/console/tokens/adjust', component: TokenAdjust },
  { path: '/console/tokens/transactions', component: TokenTransactions },

  { path: '/console/monitoring', component: Monitoring },
  { path: '/console/admins', component: AdminAccounts },
  { path: '/console/roles', component: Placeholder('角色权限') },
]

export const router = createRouter({ history: createWebHistory(), routes })
