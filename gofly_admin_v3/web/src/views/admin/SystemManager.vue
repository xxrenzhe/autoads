<template>
  <div class="system-manager">
    <h2>系统管理</h2>
    <section class="card">
      <h3>系统配置（环境变量）</h3>
      <div class="toolbar">
        <input v-model="filterCategory" placeholder="分类（如 general, upload）" />
        <button @click="loadConfigs">刷新</button>
      </div>
      <table class="table">
        <thead>
          <tr>
            <th>Key</th>
            <th>Value</th>
            <th>Category</th>
            <th>Description</th>
            <th>Active</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in configs" :key="item.id">
            <td>{{ item.config_key }}</td>
            <td>{{ item.config_value }}</td>
            <td>{{ item.category }}</td>
            <td>{{ item.description }}</td>
            <td>{{ item.is_active ? '是' : '否' }}</td>
            <td>
              <button @click="editConfig(item)">编辑</button>
              <button @click="removeConfig(item)" :disabled="loading">删除</button>
            </td>
          </tr>
        </tbody>
      </table>

      <div class="form">
        <h4>{{ form.id ? '编辑配置' : '新增配置' }}</h4>
        <input v-model.trim="form.key" placeholder="key" />
        <input v-model.trim="form.value" placeholder="value" />
        <input v-model.trim="form.category" placeholder="category（默认general）" />
        <input v-model.trim="form.description" placeholder="description" />
        <label>
          <input type="checkbox" v-model="form.is_active" /> Active
        </label>
        <div class="actions">
          <button @click="saveConfig" :disabled="loading">保存</button>
          <button @click="resetForm" :disabled="loading">重置</button>
        </div>
        <p v-if="error" class="error">{{ error }}</p>
      </div>

      <div class="history">
        <h4>变更历史</h4>
        <div class="toolbar">
          <input v-model.trim="historyKey" placeholder="按 key 过滤历史（留空为全部）" />
          <button @click="loadHistory">刷新历史</button>
        </div>
        <table class="table">
          <thead>
            <tr>
              <th>时间</th>
              <th>管理员</th>
              <th>操作</th>
              <th>详情</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="h in history" :key="h.id">
              <td>{{ h.created_at }}</td>
              <td>{{ h.admin_id }}</td>
              <td>{{ h.operation }}</td>
              <td><pre style="white-space:pre-wrap;word-break:break-all">{{ h.details }}</pre></td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section class="card">
      <h3>限速控制（套餐）</h3>
      <div class="toolbar">
        <button @click="loadRatePlans">刷新</button>
      </div>
      <table class="table">
        <thead>
          <tr>
            <th>Plan</th>
            <th>Feature</th>
            <th>PerMinute</th>
            <th>PerHour</th>
            <th>Concurrent</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in ratePlans" :key="r.id">
            <td>{{ r.plan }}</td>
            <td>{{ r.feature }}</td>
            <td>{{ r.per_minute }}</td>
            <td>{{ r.per_hour }}</td>
            <td>{{ r.concurrent }}</td>
          </tr>
        </tbody>
      </table>

      <div class="form">
        <h4>更新套餐限速</h4>
        <input v-model.trim="rlForm.plan" placeholder="plan（如 FREE/PRO/MAX）" />
        <input type="number" v-model.number="rlForm.api_per_minute" placeholder="api_per_minute" />
        <input type="number" v-model.number="rlForm.api_per_hour" placeholder="api_per_hour" />
        <input type="number" v-model.number="rlForm.siterank_per_minute" placeholder="siterank_per_minute" />
        <input type="number" v-model.number="rlForm.siterank_per_hour" placeholder="siterank_per_hour" />
        <input type="number" v-model.number="rlForm.batch_concurrent" placeholder="batch_concurrent" />
        <input type="number" v-model.number="rlForm.batch_tasks_per_minute" placeholder="batch_tasks_per_minute" />
        <div class="actions">
          <button @click="updatePlanRate" :disabled="loading">更新</button>
        </div>
        <p v-if="rlError" class="error">{{ rlError }}</p>
      </div>
    </section>
  </div>
  
</template>

<script>
export default {
  name: 'SystemManager',
  data() {
    return {
      loading: false,
      error: '',
      configs: [],
      filterCategory: '',
      form: { id: null, key: '', value: '', category: 'general', description: '', is_active: true },
      historyKey: '',
      history: [],
      ratePlans: [],
      rlForm: { plan: 'PRO', api_per_minute: 100, api_per_hour: 5000, siterank_per_minute: 10, siterank_per_hour: 200, batch_concurrent: 5, batch_tasks_per_minute: 20 },
      rlError: ''
    }
  },
  mounted() {
    this.loadConfigs()
    this.loadHistory()
    this.loadRatePlans()
  },
  methods: {
    async loadConfigs() {
      this.loading = true; this.error = ''
      try {
        const qs = this.filterCategory ? `?category=${encodeURIComponent(this.filterCategory)}` : ''
        const res = await fetch(`/api/v1/admin/system/config${qs}`, { headers: this.authHeader() })
        const data = await res.json()
        if (data.code === 0) this.configs = data.data || []; else this.error = data.message || '加载失败'
      } catch (e) { this.error = e.message || String(e) } finally { this.loading = false }
    },
    async loadHistory() {
      try {
        const qs = this.historyKey ? `?key=${encodeURIComponent(this.historyKey)}` : ''
        const res = await fetch(`/api/v1/admin/system/config/history${qs}`, { headers: this.authHeader() })
        const data = await res.json()
        if (data.code === 0) this.history = data.data || []
      } catch (e) { /* 忽略 */ }
    },
    editConfig(item) {
      this.form = { id: item.id, key: item.config_key, value: item.config_value, category: item.category, description: item.description, is_active: !!item.is_active }
    },
    resetForm() {
      this.form = { id: null, key: '', value: '', category: 'general', description: '', is_active: true }
    },
    async saveConfig() {
      this.loading = true; this.error = ''
      try {
        const body = { key: this.form.key, value: this.form.value, category: this.form.category, description: this.form.description, is_active: this.form.is_active }
        const res = await fetch('/api/v1/admin/system/config', { method: 'POST', headers: { 'Content-Type': 'application/json', ...this.authHeader() }, body: JSON.stringify(body) })
        const data = await res.json()
        if (data.code === 0) { this.resetForm(); this.loadConfigs() } else { this.error = data.message || '保存失败' }
      } catch (e) { this.error = e.message || String(e) } finally { this.loading = false }
    },
    async removeConfig(item) {
      if (!confirm(`确认删除 ${item.config_key}?`)) return
      this.loading = true; this.error = ''
      try {
        const res = await fetch(`/api/v1/admin/system/config/${encodeURIComponent(item.config_key)}`, { method: 'DELETE', headers: this.authHeader() })
        const data = await res.json()
        if (data.code === 0) { this.loadConfigs() } else { this.error = data.message || '删除失败' }
      } catch (e) { this.error = e.message || String(e) } finally { this.loading = false }
    },
    async loadRatePlans() {
      this.rlError = ''
      try {
        const res = await fetch('/api/v1/admin/rate-limit/plans', { headers: this.authHeader() })
        const data = await res.json()
        if (data.code === 0) this.ratePlans = data.data || []; else this.rlError = data.message || '加载失败'
      } catch (e) { this.rlError = e.message || String(e) }
    },
    async updatePlanRate() {
      this.rlError = ''
      try {
        const res = await fetch(`/api/v1/admin/rate-limit/plans/${encodeURIComponent(this.rlForm.plan)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', ...this.authHeader() }, body: JSON.stringify(this.rlForm) })
        const data = await res.json()
        if (data.code === 0) { this.loadRatePlans() } else { this.rlError = data.message || '更新失败' }
      } catch (e) { this.rlError = e.message || String(e) }
    },
    authHeader() {
      const token = localStorage.getItem('admin_token')
      return token ? { 'Authorization': `Bearer ${token}` } : {}
    }
  }
}
</script>

<style scoped>
.system-manager { padding: 16px; }
.card { background: #fff; padding: 12px; margin-bottom: 16px; border-radius: 6px; box-shadow: 0 1px 3px rgba(0,0,0,.1); }
.toolbar { margin-bottom: 8px; display:flex; gap:8px; }
.table { width: 100%; border-collapse: collapse; }
.table th, .table td { border: 1px solid #eee; padding: 6px 8px; text-align: left; }
.form { margin-top: 10px; display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 8px; }
.actions { grid-column: 1 / -1; display:flex; gap:8px; }
.error { color: #d33; }
</style>
