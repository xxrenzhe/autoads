<template>
  <a-layout style="min-height: 100vh">
    <a-layout-sider v-model:collapsed="collapsed" collapsible theme="light">
      <div class="logo">GoFly Admin</div>
      <a-menu
        mode="inline"
        :selectedKeys="[selectedKey]"
        :openKeys="openKeys"
        @openChange="onOpenChange"
      >
        <a-menu-item key="/console/dashboard" @click="go('/console/dashboard')">
          <template #icon><dashboard-outlined /></template>
          仪表盘
        </a-menu-item>

        <a-sub-menu key="user-center">
          <template #icon><user-outlined /></template>
          <template #title>用户中心</template>
          <a-menu-item key="/console/users" @click="go('/console/users')">用户列表</a-menu-item>
        </a-sub-menu>

        <a-sub-menu key="subscriptions">
          <template #icon><profile-outlined /></template>
          <template #title>订阅与计划</template>
          <a-menu-item key="/console/plans" @click="go('/console/plans')">计划管理</a-menu-item>
          <a-menu-item key="/console/user-subscriptions" @click="go('/console/user-subscriptions')">用户订阅</a-menu-item>
        </a-sub-menu>

        <a-sub-menu key="tokens">
          <template #icon><wallet-outlined /></template>
          <template #title>Token 管理</template>
          <a-menu-item key="/console/tokens/overview" @click="go('/console/tokens/overview')">总览</a-menu-item>
          <a-menu-item key="/console/tokens/adjust" @click="go('/console/tokens/adjust')">余额调整</a-menu-item>
          <a-menu-item key="/console/tokens/transactions" @click="go('/console/tokens/transactions')">消费流水</a-menu-item>
        </a-sub-menu>

        <a-sub-menu key="api">
          <template #icon><api-outlined /></template>
          <template #title>API 管理</template>
          <a-menu-item key="/console/api-manager" @click="go('/console/api-manager')">端点与Keys</a-menu-item>
          <a-menu-item key="/console/api-analytics" @click="go('/console/api-analytics')">分析与性能</a-menu-item>
        </a-sub-menu>

        <a-sub-menu key="rate-limit">
          <template #icon><thunderbolt-outlined /></template>
          <template #title>限速管理</template>
          <a-menu-item key="/console/rate-limit" @click="go('/console/rate-limit')">套餐与统计</a-menu-item>
        </a-sub-menu>

        <a-sub-menu key="system">
          <template #icon><setting-outlined /></template>
          <template #title>系统设置</template>
          <a-menu-item key="/console/system" @click="go('/console/system')">系统配置</a-menu-item>
        </a-sub-menu>

        <a-sub-menu key="monitoring">
          <template #icon><alert-outlined /></template>
          <template #title>监控与告警</template>
          <a-menu-item key="/console/monitoring" @click="go('/console/monitoring')">指标与健康</a-menu-item>
          <a-menu-item key="/console/consistency/orphans" @click="go('/console/consistency/orphans')">数据一致性</a-menu-item>
        </a-sub-menu>

        <a-sub-menu key="admins">
          <template #icon><team-outlined /></template>
          <template #title>管理员</template>
          <a-menu-item key="/console/admins" @click="go('/console/admins')">账号管理</a-menu-item>
          <a-menu-item key="/console/roles" @click="go('/console/roles')">角色权限</a-menu-item>
        </a-sub-menu>
      </a-menu>
    </a-layout-sider>
    <a-layout>
      <a-layout-header class="header">
        <div class="right">欢迎使用 GoFly Admin</div>
      </a-layout-header>
      <a-layout-content class="content">
        <router-view />
      </a-layout-content>
    </a-layout>
  </a-layout>
</template>

<script>
import { ref, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import {
  DashboardOutlined,
  UserOutlined,
  ProfileOutlined,
  WalletOutlined,
  ApiOutlined,
  ThunderboltOutlined,
  SettingOutlined,
  AlertOutlined,
  TeamOutlined
} from '@ant-design/icons-vue'

export default {
  name: 'AdminLayout',
  components: {
    DashboardOutlined,
    UserOutlined,
    ProfileOutlined,
    WalletOutlined,
    ApiOutlined,
    ThunderboltOutlined,
    SettingOutlined,
    AlertOutlined,
    TeamOutlined
  },
  setup() {
    const router = useRouter()
    const route = useRoute()
    const collapsed = ref(false)
    const selectedKey = ref(route.path)
    const openKeys = ref([route.path.split('/').slice(0,3).join('-')])
    watch(() => route.path, (p) => { selectedKey.value = p })
    const go = (p) => router.push(p)
    const onOpenChange = (keys) => { openKeys.value = keys }
    return { collapsed, selectedKey, openKeys, onOpenChange, go }
  }
}
</script>

<style scoped>
.logo { height: 48px; display:flex; align-items:center; justify-content:center; font-weight:600; }
.header { background:#fff; padding:0 16px; display:flex; align-items:center; justify-content:space-between; }
.content { margin:16px; padding:12px; background:#fff; min-height: 360px; }
</style>
