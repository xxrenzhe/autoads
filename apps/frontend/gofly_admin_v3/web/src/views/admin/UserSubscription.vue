<template>
  <div class="user-subs">
    <h2>用户订阅</h2>
    <div class="toolbar">
      <a-input v-model:value="userId" placeholder="用户ID" style="width:260px" />
      <a-button type="primary" @click="load">查询</a-button>
    </div>
    <a-table :data-source="subs" :columns="columns" rowKey="id" :loading="loading">
      <template #bodyCell="{ column, record }">
        <template v-if="column.key==='action'">
          <a-popconfirm title="取消该订阅？" @confirm="cancel(record)"><a-button size="small">取消</a-button></a-popconfirm>
        </template>
      </template>
    </a-table>
    <a-divider />
    <div class="assign">
      <a-select v-model:value="assignForm.plan_id" placeholder="选择计划" style="width:220px">
        <a-select-option v-for="p in plans" :key="p.id" :value="p.id">{{ p.name }} ({{ p.duration }}天)</a-select-option>
      </a-select>
      <a-input-number v-model:value="assignForm.days" :min="1" placeholder="天数(可选)" style="width:160px" />
      <a-button type="primary" @click="assign" :loading="assigning">分配订阅</a-button>
    </div>
  </div>
</template>

<script>
import { ref, onMounted } from 'vue'
import { subsApi } from '@/api/admin/subscriptions'
import { message } from 'ant-design-vue'
export default { name: 'UserSubscription', setup() {
  const userId = ref('')
  const subs = ref([])
  const plans = ref([])
  const loading = ref(false)
  const assigning = ref(false)
  const assignForm = ref({ plan_id: '', days: null })
  const columns = [
    { title:'计划', dataIndex:'plan_name', key:'plan_name' },
    { title:'状态', dataIndex:'status', key:'status', width:120 },
    { title:'开始', dataIndex:'started_at', key:'started_at', width:180 },
    { title:'结束', dataIndex:'ended_at', key:'ended_at', width:180 },
    { title:'操作', key:'action', width:120 }
  ]
  const loadPlans = async () => { const r = await subsApi.listPlans(); if (r.code===0) plans.value = r.data||[] }
  const load = async () => { if (!userId.value) { message.warning('请输入用户ID'); return }; loading.value = true; try { const r = await subsApi.listUserSubs(userId.value); if (r.code===0) subs.value = r.data||[] } catch (e) { message.error('加载失败') } finally { loading.value = false } }
  const assign = async () => { assigning.value = true; try { if (!userId.value || !assignForm.value.plan_id) { message.warning('请选择计划'); return } const r = await subsApi.assign(userId.value, assignForm.value); if (r.code===0) { message.success('已分配'); assignForm.value={ plan_id:'', days:null }; load() } } catch (e) { message.error('分配失败') } finally { assigning.value=false } }
  const cancel = async (rec) => { try { await subsApi.cancel(userId.value, rec.id); message.success('已取消'); load() } catch (e) { message.error('取消失败') } }
  onMounted(loadPlans)
  return { userId, subs, plans, loading, columns, assignForm, assigning, load, assign, cancel }
} }
</script>

<style scoped>
.user-subs { padding: 16px; }
.toolbar { margin-bottom: 10px; display:flex; gap:8px }
.assign { display:flex; gap:8px; align-items:center }
</style>
