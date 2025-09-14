<template>
  <div class="monitoring">
    <h2>监控与健康</h2>
    <div class="toolbar">
      <a-button type="primary" @click="load">刷新</a-button>
    </div>
    <a-row :gutter="16">
      <a-col :span="6"><a-card><a-statistic title="DB" :value="health.db_ok?'OK':'FAIL'" /></a-card></a-col>
      <a-col :span="6"><a-card><a-statistic title="Redis" :value="health.redis_ok?'OK':'FAIL'" /></a-card></a-col>
      <a-col :span="6"><a-card><a-statistic title="Goroutines" :value="health.goroutines||0" /></a-card></a-col>
      <a-col :span="6"><a-card><a-statistic title="Memory(bytes)" :value="health.memory||0" /></a-card></a-col>
    </a-row>
    <a-card class="card" title="告警规则（JSON）">
      <a-textarea v-model:value="alerts" :rows="8" />
      <div style="margin-top:8px"><a-button type="primary" @click="saveAlerts" :loading="saving">保存</a-button></div>
    </a-card>
  </div>
</template>

<script>
import { ref } from 'vue'
import request from '@/utils/request'
import { message } from 'ant-design-vue'
export default { name: 'Monitoring', setup() {
  const health = ref({})
  const alerts = ref('[]')
  const saving = ref(false)
  const load = async () => { try { const h = await request({ url:'/api/v1/admin/monitoring/health', method:'get' }); if (h.code===0) health.value = h.data; const a = await request({ url:'/api/v1/admin/monitoring/alerts', method:'get' }); if (a.code===0) alerts.value = typeof a.data==='string'?a.data:JSON.stringify(a.data,null,2) } catch { message.error('加载失败') } }
  const saveAlerts = async () => { saving.value=true; try { let data; try { data = JSON.parse(alerts.value) } catch { message.warning('请输入合法JSON'); saving.value=false; return } const r = await request({ url:'/api/v1/admin/monitoring/alerts', method:'post', data }); if (r.code===0) message.success('已保存') } catch { message.error('保存失败') } finally { saving.value=false } }
  load()
  return { health, alerts, saving, load, saveAlerts }
} }
</script>

<style scoped>
.monitoring { padding: 16px }
.toolbar { margin-bottom: 10px }
.card { margin-top: 12px }
</style>

