<template>
  <div class="api-manager">
    <h2>API 管理</h2>

    <a-card title="端点管理" class="card">
      <div class="toolbar">
        <a-input v-model:value="epForm.path" placeholder="/api/..." style="width:260px" />
        <a-select v-model:value="epForm.method" style="width:100px">
          <a-select-option value="GET">GET</a-select-option>
          <a-select-option value="POST">POST</a-select-option>
          <a-select-option value="PUT">PUT</a-select-option>
          <a-select-option value="DELETE">DELETE</a-select-option>
          <a-select-option value="PATCH">PATCH</a-select-option>
        </a-select>
        <a-input v-model:value="epForm.description" placeholder="描述" style="width:200px" />
        <a-switch v-model:checked="epForm.isActive" checked-children="启用" un-checked-children="停用" />
        <a-button type="primary" @click="saveEndpoint" :loading="saving">{{ epForm.id ? '更新' : '新增' }}</a-button>
        <a-button @click="resetEndpoint" :disabled="saving">重置</a-button>
      </div>
      <a-table :data-source="endpoints" :columns="epColumns" rowKey="id" :loading="loadingEndpoints" size="small">
        <template #bodyCell="{ column, record }">
          <template v-if="column.key==='status'">
            <a-tag :color="record.isActive ? 'green' : 'red'">{{ record.isActive ? '启用' : '停用' }}</a-tag>
          </template>
          <template v-else-if="column.key==='action'">
            <a-space>
              <a-button size="small" @click="editEndpoint(record)">编辑</a-button>
              <a-button size="small" @click="toggleEndpoint(record)" :loading="toggling[record.id]">{{ record.isActive?'停用':'启用' }}</a-button>
              <a-popconfirm title="删除该端点？" @confirm="deleteEndpoint(record)"><a-button danger size="small">删除</a-button></a-popconfirm>
            </a-space>
          </template>
        </template>
      </a-table>
    </a-card>

    <a-card title="API Keys" class="card">
      <div class="toolbar">
        <a-input v-model:value="keyForm.name" placeholder="名称" style="width:200px" />
        <a-input v-model:value="keyForm.userId" placeholder="用户ID(可选)" style="width:200px" />
        <a-switch v-model:checked="keyForm.isActive" checked-children="启用" un-checked-children="停用" />
        <a-button type="primary" @click="createKey" :loading="creatingKey">创建Key</a-button>
      </div>
      <a-alert v-if="fullKey" type="success" message="仅此一次展示" :description="fullKey" show-icon closable @close="fullKey=''" />
      <a-table :data-source="keys" :columns="keyColumns" rowKey="id" :loading="loadingKeys" size="small">
        <template #bodyCell="{ column, record }">
          <template v-if="column.key==='status'">
            <a-tag :color="record.isActive ? 'green' : 'red'">{{ record.isActive ? '启用' : '停用' }}</a-tag>
          </template>
          <template v-else-if="column.key==='action'">
            <a-space>
              <a-button size="small" @click="revokeKey(record)" :disabled="!record.isActive">撤销</a-button>
              <a-popconfirm title="删除该Key？" @confirm="deleteKey(record)"><a-button danger size="small">删除</a-button></a-popconfirm>
            </a-space>
          </template>
        </template>
      </a-table>
    </a-card>
  </div>
</template>

<script>
import { ref, reactive, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import { apiMgmt } from '@/api/admin/apiManagement'

export default {
  name: 'ApiManager',
  setup() {
    const loadingEndpoints = ref(false)
    const saving = ref(false)
    const toggling = reactive({})
    const endpoints = ref([])
    const epForm = reactive({ id: '', path: '', method: 'GET', description: '', isActive: true })

    const epColumns = [
      { title: '方法', dataIndex: 'method', key: 'method', width: 90 },
      { title: '路径', dataIndex: 'path', key: 'path' },
      { title: '描述', dataIndex: 'description', key: 'description' },
      { title: '状态', key: 'status', width: 90 },
      { title: '操作', key: 'action', width: 200 }
    ]

    const loadEndpoints = async () => {
      loadingEndpoints.value = true
      try {
        const res = await apiMgmt.listEndpoints()
        if (res.code === 0) endpoints.value = res.data || []
      } catch (e) { message.error('加载端点失败') } finally { loadingEndpoints.value = false }
    }
    const editEndpoint = (r) => { Object.assign(epForm, { id: r.id, path: r.path, method: r.method, description: r.description, isActive: r.isActive }) }
    const resetEndpoint = () => { Object.assign(epForm, { id: '', path: '', method: 'GET', description: '', isActive: true }) }
    const saveEndpoint = async () => {
      saving.value = true
      try {
        if (!epForm.path.startsWith('/api/')) { message.warning('路径需以 /api/ 开头'); return }
        if (epForm.id) {
          await apiMgmt.updateEndpoint(epForm.id, epForm)
        } else {
          await apiMgmt.createEndpoint(epForm)
        }
        await loadEndpoints(); resetEndpoint(); message.success('已保存')
      } catch (e) { message.error('保存失败') } finally { saving.value = false }
    }
    const toggleEndpoint = async (r) => { toggling[r.id] = true; try { await apiMgmt.toggleEndpoint(r.id); await loadEndpoints() } catch (e) { message.error('切换失败') } finally { toggling[r.id] = false } }
    const deleteEndpoint = async (r) => { try { await apiMgmt.deleteEndpoint(r.id); await loadEndpoints(); message.success('已删除') } catch (e) { message.error('删除失败') } }

    // Keys
    const loadingKeys = ref(false)
    const creatingKey = ref(false)
    const keys = ref([])
    const keyForm = reactive({ name: '', userId: '', isActive: true })
    const fullKey = ref('')
    const keyColumns = [
      { title: '名称', dataIndex: 'name', key: 'name' },
      { title: '前缀', dataIndex: 'keyPrefix', key: 'keyPrefix' },
      { title: '用户', dataIndex: 'userId', key: 'userId' },
      { title: '请求数', dataIndex: 'totalRequests', key: 'totalRequests', width: 100 },
      { title: '状态', key: 'status', width: 90 },
      { title: '操作', key: 'action', width: 160 }
    ]
    const loadKeys = async () => { loadingKeys.value = true; try { const res = await apiMgmt.listKeys(); if (res.code===0) keys.value = res.data||[] } catch (e) { message.error('加载Keys失败') } finally { loadingKeys.value = false } }
    const createKey = async () => { creatingKey.value = true; try { const res = await apiMgmt.createKey(keyForm); if (res.code===0) { fullKey.value = res.data.fullKey; await loadKeys(); message.success('已创建'); keyForm.name=''; keyForm.userId=''; keyForm.isActive=true } } catch (e) { message.error('创建失败') } finally { creatingKey.value = false } }
    const deleteKey = async (r) => { try { await apiMgmt.deleteKey(r.id); await loadKeys(); message.success('已删除') } catch (e) { message.error('删除失败') } }
    const revokeKey = async (r) => { try { await apiMgmt.revokeKey(r.id); await loadKeys(); message.success('已撤销') } catch (e) { message.error('撤销失败') } }

    onMounted(() => { loadEndpoints(); loadKeys() })
    return { endpoints, epColumns, epForm, loadingEndpoints, saving, toggling, editEndpoint, saveEndpoint, resetEndpoint, toggleEndpoint, deleteEndpoint,
             keys, keyColumns, keyForm, loadingKeys, creatingKey, createKey, deleteKey, revokeKey, fullKey }
  }
}
</script>

<style scoped>
.api-manager { padding: 16px; }
.card { margin-bottom: 16px; }
.toolbar { margin-bottom: 10px; display:flex; gap:8px; align-items:center }
</style>
