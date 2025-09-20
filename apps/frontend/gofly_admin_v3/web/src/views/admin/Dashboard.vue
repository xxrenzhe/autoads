<template>
  <div class="dashboard">
    <h2>系统总览</h2>
    <a-row :gutter="16">
      <a-col :span="6"><a-card><a-statistic title="活跃限流用户" :value="stats.total_active_users||0"/></a-card></a-col>
      <a-col :span="6"><a-card><a-statistic title="系统QPS" :value="stats.system_limits?.global_requests_per_second||0"/></a-card></a-col>
      <a-col :span="6"><a-card><a-statistic title="并发上限" :value="stats.system_limits?.max_concurrent_users||0"/></a-card></a-col>
    </a-row>
  </div>
</template>

<script>
import { ref, onMounted } from 'vue'
import { rateLimitApi } from '@/api/admin'
export default { name: 'Dashboard', setup() {
  const stats = ref({})
  const load = async () => {
    try { const res = await rateLimitApi.getSystemStats(); if (res.code===0) stats.value = res.data || {} } catch (e) {}
  }
  onMounted(load)
  return { stats }
}}
</script>

<style scoped>
.dashboard { padding: 16px; }
</style>
