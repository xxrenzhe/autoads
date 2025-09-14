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
  { path: '/', redirect: '/admin/dashboard' },
  { path: '/admin/dashboard', component: Dashboard },

  { path: '/admin/api-manager', component: ApiManager },
  { path: '/admin/api-analytics', component: ApiAnalytics },

  { path: '/admin/rate-limit', component: RateLimitManager },
  { path: '/admin/system', component: SystemManager },

  { path: '/admin/users', component: UserList },
  { path: '/admin/plans', component: PlanManager },
  { path: '/admin/user-subscriptions', component: UserSubscription },

  { path: '/admin/tokens/overview', component: TokenOverview },
  { path: '/admin/tokens/adjust', component: TokenAdjust },
  { path: '/admin/tokens/transactions', component: TokenTransactions },

  { path: '/admin/monitoring', component: Monitoring },
  { path: '/admin/admins', component: AdminAccounts },
  { path: '/admin/roles', component: Placeholder('角色权限') },
]

export const router = createRouter({ history: createWebHistory(), routes })
