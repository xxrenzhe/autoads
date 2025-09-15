<template>
  <div class="api-analytics">
    <h2>API 分析与性能</h2>

    <a-card class="card" title="查询条件">
      <a-space>
        <a-select v-model:value="timeRange" style="width: 140px">
          <a-select-option value="1h">最近1小时</a-select-option>
          <a-select-option value="24h">最近24小时</a-select-option>
          <a-select-option value="7d">最近7天</a-select-option>
          <a-select-option value="30d">最近30天</a-select-option>
        </a-select>
        <a-input v-model:value="endpoint" placeholder="端点过滤，如 /api/v1/user/profile" style="width: 280px" />
        <a-select v-model:value="method" style="width: 120px" allow-clear>
          <a-select-option value="GET">GET</a-select-option>
          <a-select-option value="POST">POST</a-select-option>
          <a-select-option value="PUT">PUT</a-select-option>
          <a-select-option value="DELETE">DELETE</a-select-option>
          <a-select-option value="PATCH">PATCH</a-select-option>
        </a-select>
        <a-input v-model:value="userId" placeholder="用户ID" style="width: 200px" />
        <a-input v-model:value="requestId" placeholder="Request ID" style="width: 260px" />
        <a-button type="primary" @click="refresh">刷新</a-button>
      </a-space>
    </a-card>

    <a-row :gutter="16">
      <a-col :span="6"><a-card><a-statistic title="总请求" :value="analytics.totalRequests||0"/></a-card></a-col>
      <a-col :span="6"><a-card><a-statistic title="错误数" :value="analytics.totalErrors||0"/></a-card></a-col>
      <a-col :span="6"><a-card><a-statistic title="平均响应(ms)" :value="analytics.averageResponseTime||0"/></a-card></a-col>
      <a-col :span="6"><a-card><a-statistic title="成功率(%)" :value="Number((analytics.successRate||0).toFixed(2))"/></a-card></a-col>
    </a-row>

    <a-row :gutter="16" style="margin-top:12px;">
      <a-col :span="8">
        <a-card title="Top Endpoints">
          <a-table :data-source="analytics.topEndpoints||[]" :columns="topCols" size="small" rowKey="endpoint" />
        </a-card>
      </a-col>
      <a-col :span="8">
        <a-card title="错误类型">
          <div v-for="(v,k) in analytics.errorsByType" :key="k">{{k}}: {{v}}</div>
        </a-card>
      </a-col>
      <a-col :span="8">
        <a-card title="UA 分布Top10">
          <div v-for="ua in analytics.userAgents||[]" :key="ua.userAgent" class="ua-item">
            <div class="ua-line"><span class="ua">{{ua.userAgent}}</span><span>{{ua.requests}} ({{Number(ua.percentage).toFixed(2)}}%)</span></div>
          </div>
        </a-card>
      </a-col>
    </a-row>

    <a-card class="card" title="性能指标">
      <a-row :gutter="16">
        <a-col :span="6"><a-card><a-statistic title="p50(ms)" :value="perf.p50ResponseTime||0"/></a-card></a-col>
        <a-col :span="6"><a-card><a-statistic title="p95(ms)" :value="perf.p95ResponseTime||0"/></a-card></a-col>
        <a-col :span="6"><a-card><a-statistic title="p99(ms)" :value="perf.p99ResponseTime||0"/></a-card></a-col>
        <a-col :span="6"><a-card><a-statistic title="吞吐(RPS)" :value="Number((perf.throughput||0).toFixed(2))"/></a-card></a-col>
      </a-row>
      <a-row :gutter="16" style="margin-top:12px;">
        <a-col :span="6"><a-card><a-statistic title="错误率(%)" :value="Number((perf.errorRate||0).toFixed(2))"/></a-card></a-col>
        <a-col :span="6"><a-card><a-statistic title="可用性(%)" :value="Number((perf.availability||0).toFixed(2))"/></a-card></a-col>
      </a-row>
    </a-card>

    <a-card class="card" title="最近请求（可按 Request ID 追踪）">
      <a-table :data-source="analytics.list||[]" :columns="listCols" size="small" rowKey="id" />
      <div style="margin-top:6px">共 {{ analytics.pagination?.total || 0 }} 条</div>
    </a-card>
  </div>
</template>

<script>
import { ref } from 'vue'
import { apiMgmt } from '@/api/admin/apiManagement'

export default {
  name: 'ApiAnalytics',
  setup() {
    const timeRange = ref('24h')
    const endpoint = ref('')
    const method = ref()
    const userId = ref('')
    const requestId = ref('')
    const analytics = ref({})
    const perf = ref({})
    const topCols = [
      { title: '端点', dataIndex: 'endpoint', key: 'endpoint' },
      { title: '请求', dataIndex: 'requests', key: 'requests', width: 90 },
      { title: '错误', dataIndex: 'errors', key: 'errors', width: 90 },
      { title: '均耗(ms)', dataIndex: 'avgResponseTime', key: 'avgResponseTime', width: 100 },
      { title: '成功率(%)', dataIndex: 'successRate', key: 'successRate', width: 110 }
    ]
    const showReq = ref(false)
    const reqDetail = ref({})
    const listCols = [
      { title: '时间', dataIndex: 'created_at', key: 'created_at', width: 180 },
      { title: 'ID', dataIndex: 'id', key: 'id', width: 220, customRender: ({text}) => text ? String(text).substring(0, 64) : '' },
      { title: '用户', dataIndex: 'user_id', key: 'user_id', width: 160 },
      { title: '方法', dataIndex: 'method', key: 'method', width: 80 },
      { title: '端点', dataIndex: 'endpoint', key: 'endpoint' },
      { title: '状态', dataIndex: 'status_code', key: 'status_code', width: 90 },
      { title: '耗时(ms)', dataIndex: 'duration_ms', key: 'duration_ms', width: 100 },
      { title: '操作', key: 'action', width: 120, customRender: ({record}) => ({
        children: [
          // 查看按钮
          h('a', { style: 'margin-right:8px', onClick: async () => {
            const res = await apiMgmt.getRequest(record.id)
            if (res.code === 0) { reqDetail.value = res.data; showReq.value = true }
          }}, '查看'),
          // 复制ID
          h('a', { onClick: () => { navigator.clipboard?.writeText(String(record.id||'')) } }, '复制ID')
        ]
      }) }
    ]
    const refresh = async () => {
      const params = { timeRange: timeRange.value }
      if (endpoint.value) params.endpoint = endpoint.value
      if (method.value) params.method = method.value
      if (userId.value) params.userId = userId.value
      if (requestId.value) params.requestId = requestId.value
      const a = await apiMgmt.getAnalytics(params)
      if (a.code === 0) analytics.value = a.data
      const p = await apiMgmt.getPerformance(params)
      if (p.code === 0) perf.value = p.data
    }
    refresh()
    return { timeRange, endpoint, method, userId, requestId, analytics, perf, topCols, listCols, refresh, showReq, reqDetail }
  }
}
</script>

<script setup>
import { h } from 'vue'
</script>

<template>
  <!-- 追加在末尾：请求详情弹窗 -->
  <a-modal v-model:open="showReq" title="请求详情" :footer="null" width="720px">
    <pre style="white-space:pre-wrap;word-break:break-all">{{ JSON.stringify(reqDetail, null, 2) }}</pre>
  </a-modal>
  <!-- 原模板内容已在上方 -->
</template>

<style scoped>
.api-analytics { padding: 16px; }
.card { margin-top: 16px; }
.ua-item { margin: 4px 0; }
.ua-line { display:flex; justify-content:space-between; gap:8px; }
.ua { display:inline-block; max-width: 360px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
</style>
