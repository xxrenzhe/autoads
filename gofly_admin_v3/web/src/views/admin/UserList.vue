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
            <a-button size="small" @click="openAssign(record)">调整订阅</a-button>
            <a-button size="small" @click="openToken(record)">充值Token</a-button>
            <a-popconfirm title="切换状态？" @confirm="toggle(record)"><a-button size="small">{{ record.status==='ACTIVE'?'禁用':'启用' }}</a-button></a-popconfirm>
          </a-space>
        </template>
      </template>
    </a-table>

    <!-- 调整订阅弹窗 -->
    <a-modal v-model:open="assignVisible" title="调整订阅" :confirmLoading="assignLoading" @ok="doAssign" @cancel="assignVisible=false">
      <div style="display:grid;gap:8px">
        <a-input v-model:value="assignForm.plan_id" placeholder="plan_id（如 PRO/MAX 的ID）" />
        <a-input-number v-model:value="assignForm.days" :min="1" :step="1" style="width:100%" placeholder="有效期（天），默认按计划duration" />
        <div>用户：{{ currentUser?.email }}（ID: {{ currentUser?.id }}）</div>
      </div>
    </a-modal>

    <!-- 充值Token弹窗 -->
    <a-modal v-model:open="tokenVisible" title="充值/扣减 Token" :confirmLoading="tokenLoading" @ok="doTokenAdjust" @cancel="tokenVisible=false">
      <div style="display:grid;gap:8px">
        <a-input-number v-model:value="tokenForm.delta" :step="1" style="width:100%" placeholder="变动数量（正数充值，负数扣减）" />
        <a-input v-model:value="tokenForm.reason" placeholder="原因备注" />
        <div>当前余额：{{ currentUser?.token_balance }}</div>
      </div>
    </a-modal>
  </div>
</template>

<script>
import { ref, reactive, onMounted } from 'vue'
import { usersApi } from '@/api/admin/users'
import subsApi from '@/api/admin/subscriptions'
import tokensApi from '@/api/admin/tokens'
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
  const currentUser = ref(null)
  const assignVisible = ref(false)
  const assignLoading = ref(false)
  const assignForm = reactive({ plan_id: '', days: null })
  const tokenVisible = ref(false)
  const tokenLoading = ref(false)
  const tokenForm = reactive({ delta: 0, reason: '' })

  const openAssign = (r) => { currentUser.value = r; assignForm.plan_id=''; assignForm.days=null; assignVisible.value = true }
  const openToken = (r) => { currentUser.value = r; tokenForm.delta=0; tokenForm.reason=''; tokenVisible.value = true }
  const doAssign = async () => {
    if (!currentUser.value || !assignForm.plan_id) { message.warning('请填写 plan_id'); return }
    assignLoading.value = true
    try {
      const body = { plan_id: assignForm.plan_id }
      if (assignForm.days && assignForm.days > 0) body.days = assignForm.days
      const res = await subsApi.assign(currentUser.value.id, body)
      if (res.code === 0) { message.success('已调整订阅'); assignVisible.value = false; load() } else { message.error(res.message || '操作失败') }
    } catch (e) { message.error('操作失败') } finally { assignLoading.value = false }
  }
  const doTokenAdjust = async () => {
    if (!currentUser.value || !tokenForm.delta) { message.warning('请输入变动数量'); return }
    tokenLoading.value = true
    try {
      const res = await tokensApi.adjust(currentUser.value.id, { delta: tokenForm.delta, reason: tokenForm.reason || 'manual' })
      if (res.code === 0) { message.success('已变更Token'); tokenVisible.value = false; load() } else { message.error(res.message || '操作失败') }
    } catch (e) { message.error('操作失败') } finally { tokenLoading.value = false }
  }
  const toggle = async (r) => { try { const newStatus = r.status==='ACTIVE'?'SUSPENDED':'ACTIVE'; await usersApi.updateStatus(r.id, newStatus); message.success('已更新'); load() } catch (e) { message.error('更新失败') } }
  onMounted(load)
  return { loading, keyword, status, items, columns, pagination, load, onChange, toggle, currentUser, assignVisible, assignLoading, assignForm, tokenVisible, tokenLoading, tokenForm, openAssign, openToken, doAssign, doTokenAdjust }
} }
</script>

<style scoped>
.user-list { padding: 16px; }
.toolbar { margin-bottom: 10px; display:flex; gap:8px; }
</style>
