<template>
  <div class="system-manager">
    <h2>系统管理</h2>
    <!-- 有效配置快照（只读） -->
    <section class="card">
      <h3>有效配置快照（只读）</h3>
      <div class="toolbar">
        <button @click="loadEffective">刷新</button>
        <span v-if="effectiveVersion">version: {{ effectiveVersion }}</span>
        <span v-if="effectiveEtag">ETag: {{ effectiveEtag }}</span>
      </div>
      <div v-if="effectiveObj">
        <div class="tree-toolbar">
          <button @click="expandAll">全部展开</button>
          <button @click="collapseAll">全部折叠</button>
          <input v-model.trim="treeFilter" placeholder="筛选关键字（key/value）" />
        </div>
        <TreeNode :data="effectiveObj" :level="0" :filter="treeFilter" :expanded-keys="expandedKeys" @toggle="onToggle" />
      </div>
      <div v-else>点击刷新以查看当前生效配置</div>
    </section>

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
        <button @click="broadcastReload" :disabled="loading">立即广播刷新</button>
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

    <section class="card">
      <h3>套餐限额 JSON（rate_limit_plans）</h3>
      <div class="toolbar">
        <button @click="loadRatePlansJSON">刷新</button>
        <button @click="fillRatePlansTemplate">填充模板</button>
        <button @click="saveRatePlansJSON" :disabled="loading">保存</button>
        <button @click="saveAndReload" :disabled="loading">保存并刷新</button>
      </div>
      <textarea v-model="ratePlansJSON" rows="10" style="width:100%; font-family: ui-monospace, SFMono-Regular, Menlo, monospace;"></textarea>
      <p v-if="ratePlansJSONError" class="error">{{ ratePlansJSONError }}</p>
    </section>

    <section class="card">
      <h3>限流策略探测器</h3>
      <div class="toolbar">
        <input v-model.trim="probeForm.plan" placeholder="套餐（如 FREE/PRO）" style="width: 160px" />
        <select v-model="probeForm.method" style="width: 100px">
          <option>GET</option>
          <option>POST</option>
          <option>PUT</option>
          <option>DELETE</option>
          <option>PATCH</option>
        </select>
        <input v-model.trim="probeForm.path" placeholder="测试路径（默认 /health）" style="width: 260px" />
        <button @click="runProbe" :disabled="loading">执行</button>
      </div>
      <div v-if="Object.keys(probeHeaders).length">
        <h4>响应头</h4>
        <pre style="white-space:pre-wrap;word-break:break-all">{{ JSON.stringify(probeHeaders, null, 2) }}</pre>
      </div>
    </section>
  </div>
  
</template>

<script>
import TreeNode from '@/components/TreeNode.vue'
export default {
  name: 'SystemManager',
  components: { TreeNode },
  data() {
    return {
      loading: false,
      error: '',
      effectiveJSON: '',
      effectiveObj: null,
      effectiveVersion: '',
      effectiveEtag: '',
      treeFilter: '',
      expandedKeys: new Set(),
      configs: [],
      filterCategory: '',
      form: { id: null, key: '', value: '', category: 'general', description: '', is_active: true },
      historyKey: '',
      history: [],
      ratePlans: [],
      rlForm: { plan: 'PRO', api_per_minute: 100, api_per_hour: 5000, siterank_per_minute: 10, siterank_per_hour: 200, batch_concurrent: 5, batch_tasks_per_minute: 20 },
      rlError: '',
      ratePlansJSON: '',
      ratePlansJSONError: '',
      probeForm: { plan: 'FREE', method: 'GET', path: '/health' },
      probeHeaders: {}
    }
  },
  mounted() {
    this.loadEffective()
    this.loadConfigs()
    this.loadHistory()
    this.loadRatePlans()
  },
    methods: {
    async loadEffective() {
      try {
        const res = await fetch('/ops/console/config/v1', { headers: this.authHeader() })
        const etag = res.headers.get('ETag') || res.headers.get('etag') || ''
        const data = await res.json()
        this.effectiveVersion = data.version || ''
        this.effectiveEtag = etag
        this.effectiveJSON = JSON.stringify(data.config || {}, null, 2)
        this.effectiveObj = data.config || null
        this.expandedKeys = new Set(['$root'])
      } catch (e) { /* 忽略 */ }
    },
    expandAll() {
      const keys = new Set()
      function walk(obj, prefix) {
        keys.add(prefix)
        if (obj && typeof obj === 'object') {
          Object.keys(obj).forEach(k => walk(obj[k], prefix + '.' + k))
        }
      }
      walk(this.effectiveObj, '$root')
      this.expandedKeys = keys
    },
    collapseAll() {
      this.expandedKeys = new Set(['$root'])
    },
    onToggle(key) {
      const s = new Set(this.expandedKeys)
      if (s.has(key)) s.delete(key); else s.add(key)
      this.expandedKeys = s
    },
    async loadConfigs() {
      this.loading = true; this.error = ''
      try {
        const qs = this.filterCategory ? `?category=${encodeURIComponent(this.filterCategory)}` : ''
        const res = await fetch(`/api/v1/console/system/config${qs}`, { headers: this.authHeader() })
        const data = await res.json()
        if (data.code === 0) this.configs = data.data || []; else this.error = data.message || '加载失败'
      } catch (e) { this.error = e.message || String(e) } finally { this.loading = false }
    },
    async loadHistory() {
      try {
        const qs = this.historyKey ? `?key=${encodeURIComponent(this.historyKey)}` : ''
        const res = await fetch(`/api/v1/console/system/config/history${qs}`, { headers: this.authHeader() })
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
        const res = await fetch('/api/v1/console/system/config', { method: 'POST', headers: { 'Content-Type': 'application/json', ...this.authHeader() }, body: JSON.stringify(body) })
        const data = await res.json()
        if (data.code === 0) { this.resetForm(); this.loadConfigs() } else { this.error = data.message || '保存失败' }
      } catch (e) { this.error = e.message || String(e) } finally { this.loading = false }
    },
    async removeConfig(item) {
      if (!confirm(`确认删除 ${item.config_key}?`)) return
      this.loading = true; this.error = ''
      try {
        const res = await fetch(`/api/v1/console/system/config/${encodeURIComponent(item.config_key)}`, { method: 'DELETE', headers: this.authHeader() })
        const data = await res.json()
        if (data.code === 0) { this.loadConfigs() } else { this.error = data.message || '删除失败' }
      } catch (e) { this.error = e.message || String(e) } finally { this.loading = false }
    },
    async loadRatePlans() {
      this.rlError = ''
      try {
        const res = await fetch('/api/v1/console/rate-limit/plans', { headers: this.authHeader() })
        const data = await res.json()
        if (data.code === 0) this.ratePlans = data.data || []; else this.rlError = data.message || '加载失败'
      } catch (e) { this.rlError = e.message || String(e) }
    },
    async updatePlanRate() {
      this.rlError = ''
      try {
        const res = await fetch(`/api/v1/console/rate-limit/plans/${encodeURIComponent(this.rlForm.plan)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', ...this.authHeader() }, body: JSON.stringify(this.rlForm) })
        const data = await res.json()
        if (data.code === 0) { this.loadRatePlans() } else { this.rlError = data.message || '更新失败' }
      } catch (e) { this.rlError = e.message || String(e) }
    },
    async broadcastReload() {
      this.rlError = ''
      try {
        const res = await fetch('/api/v1/console/rate-limit/reload', { method: 'POST', headers: this.authHeader() })
        const data = await res.json()
        if (data.code === 0) { /* ok */ } else { this.rlError = data.message || '广播失败' }
      } catch (e) { this.rlError = e.message || String(e) }
    },
    async loadRatePlansJSON() {
      this.ratePlansJSONError = ''
      try {
        const res = await fetch('/api/v1/console/system/config?category=ratelimit', { headers: this.authHeader() })
        const data = await res.json()
        if (data.code === 0) {
          const item = (data.data || []).find((x) => x.config_key === 'rate_limit_plans')
          this.ratePlansJSON = item ? item.config_value : ''
        }
      } catch (e) { this.ratePlansJSONError = e.message || String(e) }
    },
    fillRatePlansTemplate() {
      this.ratePlansJSON = JSON.stringify({
        FREE: { rps: 5, burst: 10 },
        BASIC: { rps: 20, burst: 40 },
        PRO: { rps: 50, burst: 100 },
        ENTERPRISE: { rps: 200, burst: 400 }
      }, null, 2)
    },
    async saveRatePlansJSON() {
      this.loading = true; this.ratePlansJSONError = ''
      try {
        try { JSON.parse(this.ratePlansJSON || '{}') } catch (e) { this.ratePlansJSONError = 'JSON 无效'; this.loading = false; return }
        const body = { key: 'rate_limit_plans', value: this.ratePlansJSON, category: 'ratelimit', description: 'plan rates JSON', is_active: true }
        const res = await fetch('/api/v1/console/system/config', { method: 'POST', headers: { 'Content-Type': 'application/json', ...this.authHeader() }, body: JSON.stringify(body) })
        const data = await res.json()
        if (data.code !== 0) this.ratePlansJSONError = data.message || '保存失败'
      } catch (e) { this.ratePlansJSONError = e.message || String(e) } finally { this.loading = false }
    },
    async saveAndReload() {
      await this.saveRatePlansJSON(); await this.broadcastReload()
    },
    async runProbe() {
      this.loading = true; this.probeHeaders = {}
      try {
        const path = this.probeForm.path || '/health'
        const method = this.probeForm.method || 'GET'
        const plan = (this.probeForm.plan || '').trim()
        const headers = plan ? { 'X-User-Plan': plan } : {}
        const res = await fetch(path, { method, headers })
        const wanted = ['x-ratelimit-plan','x-ratelimit-policy','x-ratelimit-limit','x-ratelimit-remaining','x-ratelimit-reset','x-request-id','server-timing']
        const out = {}
        wanted.forEach(k => { const v = res.headers.get(k); if (v) out[k] = v })
        this.probeHeaders = out
      } catch (e) { this.probeHeaders = { error: e.message || String(e) } } finally { this.loading = false }
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
.tree-toolbar { margin: 6px 0; display:flex; gap:8px; }
.tree-node { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace; font-size: 12px; }
.tree-node .toggle { cursor: pointer; margin-right: 6px; color: #555; }
.tree-node .node-type { color: #888; margin-right: 6px; }
.tree-node .leaf { color: #222; }
.table { width: 100%; border-collapse: collapse; }
.table th, .table td { border: 1px solid #eee; padding: 6px 8px; text-align: left; }
.form { margin-top: 10px; display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 8px; }
.actions { grid-column: 1 / -1; display:flex; gap:8px; }
.error { color: #d33; }
</style>
