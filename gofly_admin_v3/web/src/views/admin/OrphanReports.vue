<template>
  <div class="orphans">
    <h2>数据一致性 - 孤儿巡检</h2>
    <div class="toolbar">
      <a-space>
        <a-select v-model:value="days" style="width:120px">
          <a-select-option :value="7">近 7 天</a-select-option>
          <a-select-option :value="14">近 14 天</a-select-option>
          <a-select-option :value="30">近 30 天</a-select-option>
        </a-select>
        <a-select v-model:value="limit" style="width:140px">
          <a-select-option :value="10">最新 10 条</a-select-option>
          <a-select-option :value="20">最新 20 条</a-select-option>
          <a-select-option :value="30">最新 30 条</a-select-option>
        </a-select>
        <a-button type="primary" @click="load" :loading="loading">刷新</a-button>
      </a-space>
    </div>

    <a-card title="趋势 (总孤儿数/日)" class="card">
      <div class="chart">
        <div v-for="(d,i) in trend.labels" :key="d" class="bar-wrap">
          <div class="bar" :style="{ height: barHeight(trend.totals[i]) + 'px' }" :title="trend.totals[i]" />
          <div class="label">{{ d.slice(5) }}</div>
        </div>
      </div>
    </a-card>

    <a-card title="最近巡检结果" class="card">
      <a-table :dataSource="latest" :columns="columns" :pagination="false" rowKey="id" :loading="loading"
        :expandedRowRender="expandedRow">
        <template #bodyCell="{ column, record }">
          <template v-if="column.key==='created_at'">{{ new Date(record.created_at).toLocaleString() }}</template>
          <template v-else-if="column.key==='total'">
            <a-badge :status="record.total_orphans>0?'error':'success'" :text="record.total_orphans" />
          </template>
        </template>
      </a-table>
    </a-card>
  </div>
</template>

<script>
import { ref } from 'vue'
import { message } from 'ant-design-vue'
import { consistencyApi } from '@/api/admin/consistency'

export default { name: 'OrphanReports', setup() {
  const days = ref(30)
  const limit = ref(20)
  const loading = ref(false)
  const latest = ref([])
  const trend = ref({ labels: [], totals: [] })
  const maxTotal = ref(1)
  const columns = [
    { title: '时间', dataIndex: 'created_at', key: 'created_at' },
    { title: '孤儿数量', dataIndex: 'total_orphans', key: 'total' }
  ]
  const expandedRow = (record) => {
    const by = record.by_check || {}
    const keys = Object.keys(by).sort()
    return (
      <div style="font-family:monospace">
        { keys.length===0 ? '无明细' : keys.map(k => <div>{k}: {by[k]}</div>) }
      </div>
    )
  }
  const barHeight = (v) => {
    const max = Math.max(1, maxTotal.value)
    const h = Math.round((v / max) * 120)
    return Math.max(2, h)
  }
  const load = async () => {
    loading.value = true
    try {
      const r = await consistencyApi.getOrphanReports({ days: days.value, limit: limit.value })
      if (r.code === 0) {
        latest.value = r.data.latest || []
        trend.value = r.data.trend || { labels: [], totals: [] }
        maxTotal.value = Math.max(1, ...(trend.value.totals||[1]))
      } else { message.error(r.message||'加载失败') }
    } catch (e) { message.error('加载失败') } finally { loading.value=false }
  }
  load()
  return { days, limit, loading, latest, trend, columns, expandedRow, barHeight }
} }
</script>

<style scoped>
.orphans { padding: 16px }
.toolbar { margin-bottom: 12px }
.card { margin-top: 12px }
.chart { display:flex; align-items:flex-end; gap:8px; height: 140px; padding: 12px 8px; border: 1px dashed #eee; overflow-x:auto }
.bar-wrap { display:flex; flex-direction:column; align-items:center }
.bar { width: 18px; background: #1677ff; border-radius: 3px 3px 0 0 }
.label { font-size: 12px; margin-top: 6px; color: #888 }
</style>

