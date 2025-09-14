<template>
  <div class="user-list">
    <h2>用户列表</h2>
    <div class="toolbar">
      <a-input v-model:value="keyword" placeholder="邮箱/用户名" style="width:220px" />
      <a-select v-model:value="status" style="width:140px" allow-clear placeholder="状态">
        <a-select-option value="ACTIVE">ACTIVE</a-select-option>
        <a-select-option value="SUSPENDED">SUSPENDED</a-select-option>
      </a-select>
      <a-button type="primary" @click="load">查询</a-button>
    </div>
    <a-table :data-source="items" :columns="columns" rowKey="id" :loading="loading" :pagination="pagination" @change="onChange">
      <template #bodyCell="{ column, record }">
        <template v-if="column.key==='action'">
          <a-space>
            <a-button size="small" @click="view(record)">详情</a-button>
            <a-popconfirm title="切换状态？" @confirm="toggle(record)"><a-button size="small">{{ record.status==='ACTIVE'?'禁用':'启用' }}</a-button></a-popconfirm>
          </a-space>
        </template>
      </template>
    </a-table>
  </div>
</template>

<script>
import { ref, reactive, onMounted } from 'vue'
import { usersApi } from '@/api/admin/users'
import { message } from 'ant-design-vue'
export default { name: 'UserList', setup() {
  const loading = ref(false)
  const keyword = ref('')
  const status = ref('')
  const items = ref([])
  const pagination = reactive({ current:1, pageSize:20, total:0 })
  const columns = [
    { title:'ID', dataIndex:'id', key:'id', width:220 },
    { title:'邮箱', dataIndex:'email', key:'email' },
    { title:'用户名', dataIndex:'username', key:'username' },
    { title:'角色', dataIndex:'role', key:'role', width:100 },
    { title:'状态', dataIndex:'status', key:'status', width:110 },
    { title:'Token', dataIndex:'token_balance', key:'token_balance', width:110 },
    { title:'创建时间', dataIndex:'created_at', key:'created_at', width:180 },
    { title:'操作', key:'action', width:160 }
  ]
  const load = async () => {
    loading.value = true
    try {
      const res = await usersApi.list({ keyword: keyword.value, status: status.value, page: pagination.current, size: pagination.pageSize })
      if (res.code===0) { items.value = res.data.items; pagination.total = res.data.total }
    } catch(e) { message.error('加载失败') } finally { loading.value = false }
  }
  const onChange = (pag) => { pagination.current = pag.current; pagination.pageSize = pag.pageSize; load() }
  const view = (r) => { window.open(`/admin/users/${r.id}`, '_blank') }
  const toggle = async (r) => { try { const newStatus = r.status==='ACTIVE'?'SUSPENDED':'ACTIVE'; await usersApi.updateStatus(r.id, newStatus); message.success('已更新'); load() } catch { message.error('更新失败') } }
  onMounted(load)
  return { loading, keyword, status, items, columns, pagination, load, onChange, view, toggle }
} }
</script>

<style scoped>
.user-list { padding: 16px; }
.toolbar { margin-bottom: 10px; display:flex; gap:8px; }
</style>

