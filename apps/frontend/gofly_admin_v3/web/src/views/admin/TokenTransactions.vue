<template>
  <div class="token-tx">
    <h2>Token 消费流水</h2>
    <div class="toolbar">
      <a-input v-model:value="userId" placeholder="用户ID" style="width:220px" />
      <a-input v-model:value="service" placeholder="服务" style="width:160px" />
      <a-input v-model:value="action" placeholder="动作" style="width:160px" />
      <a-select v-model:value="type" allow-clear placeholder="类型" style="width:140px">
        <a-select-option value="consume">consume</a-select-option>
        <a-select-option value="purchase">purchase</a-select-option>
        <a-select-option value="refund">refund</a-select-option>
        <a-select-option value="adjust">adjust</a-select-option>
      </a-select>
      <a-button type="primary" @click="load">查询</a-button>
    </div>
    <a-table :data-source="items" :columns="columns" rowKey="id" :loading="loading" :pagination="pagination" @change="onChange" />
  </div>
</template>

<script>
import { ref, reactive, onMounted } from 'vue'
import { tokenApi } from '@/api/admin/tokens'
import { message } from 'ant-design-vue'
export default { name: 'TokenTransactions', setup() {
  const userId = ref(''); const service = ref(''); const action = ref(''); const type = ref('')
  const loading = ref(false)
  const items = ref([])
  const pagination = reactive({ current:1, pageSize:20, total:0 })
  const columns = [
    { title:'时间', dataIndex:'created_at', key:'created_at', width:180 },
    { title:'用户', dataIndex:'user_id', key:'user_id', width:220 },
    { title:'金额', dataIndex:'amount', key:'amount', width:100 },
    { title:'类型', dataIndex:'type', key:'type', width:120 },
    { title:'服务', dataIndex:'service', key:'service', width:120 },
    { title:'动作', dataIndex:'action', key:'action', width:120 },
    { title:'RefID', dataIndex:'ref_id', key:'ref_id', width:180 },
    { title:'详情', dataIndex:'details', key:'details' }
  ]
  const load = async () => { loading.value=true; try { const r = await tokenApi.listTx({ userId: userId.value, service: service.value, action: action.value, type: type.value, page: pagination.current, size: pagination.pageSize }); if (r.code===0) { items.value = r.data.items; pagination.total = r.data.total } } catch (e) { message.error('加载失败') } finally { loading.value=false } }
  const onChange = (pag) => { pagination.current = pag.current; pagination.pageSize = pag.pageSize; load() }
  onMounted(load)
  return { userId, service, action, type, loading, items, columns, pagination, load, onChange }
} }
</script>

<style scoped>
.token-tx { padding: 16px }
.toolbar { margin-bottom: 10px; display:flex; gap:8px }
</style>
