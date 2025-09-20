<template>
  <div class="plans">
    <h2>计划管理</h2>
    <div class="toolbar">
      <a-input v-model:value="form.name" placeholder="名称" style="width:160px" />
      <a-input v-model:value="form.description" placeholder="描述" style="width:240px" />
      <a-input-number v-model:value="form.price" placeholder="价格" :min="0" style="width:120px" />
      <a-input-number v-model:value="form.duration" placeholder="天数" :min="1" style="width:120px" />
      <a-select v-model:value="form.status" style="width:120px">
        <a-select-option value="ACTIVE">ACTIVE</a-select-option>
        <a-select-option value="INACTIVE">INACTIVE</a-select-option>
      </a-select>
      <a-button type="primary" @click="save" :loading="saving">{{ form.id? '更新':'新增' }}</a-button>
      <a-button @click="reset" :disabled="saving">重置</a-button>
    </div>
    <a-table :data-source="items" :columns="columns" rowKey="id" :loading="loading">
      <template #bodyCell="{ column, record }">
        <template v-if="column.key==='action'">
          <a-space>
            <a-button size="small" @click="edit(record)">编辑</a-button>
            <a-popconfirm title="删除该计划？" @confirm="del(record)"><a-button size="small" danger>删除</a-button></a-popconfirm>
          </a-space>
        </template>
      </template>
    </a-table>
  </div>
</template>

<script>
import { ref, reactive, onMounted } from 'vue'
import { subsApi } from '@/api/admin/subscriptions'
import { message } from 'ant-design-vue'
export default { name: 'PlanManager', setup() {
  const loading = ref(false)
  const saving = ref(false)
  const items = ref([])
  const form = reactive({ id:'', name:'', description:'', price:0, duration:30, status:'ACTIVE' })
  const columns = [
    { title:'名称', dataIndex:'name', key:'name' },
    { title:'描述', dataIndex:'description', key:'description' },
    { title:'价格', dataIndex:'price', key:'price', width:100 },
    { title:'天数', dataIndex:'duration', key:'duration', width:100 },
    { title:'状态', dataIndex:'status', key:'status', width:120 },
    { title:'操作', key:'action', width:160 }
  ]
  const load = async () => { loading.value = true; try { const r = await subsApi.listPlans(); if (r.code===0) items.value = r.data||[] } catch (e) { message.error('加载失败') } finally { loading.value=false } }
  const reset = () => Object.assign(form, { id:'', name:'', description:'', price:0, duration:30, status:'ACTIVE' })
  const save = async () => { saving.value = true; try { if (!form.name) { message.warning('名称必填'); return } if (form.id) { await subsApi.updatePlan(form.id, form) } else { await subsApi.createPlan(form) } await load(); reset(); message.success('已保存') } catch (e) { message.error('保存失败') } finally { saving.value = false } }
  const edit = (r) => Object.assign(form, { id:r.id, name:r.name, description:r.description, price:r.price, duration:r.duration, status:r.status })
  const del = async (r) => { try { await subsApi.deletePlan(r.id); await load(); message.success('已删除') } catch (e) { message.error('删除失败') } }
  onMounted(load)
  return { loading, items, columns, form, saving, save, reset, edit, del }
} }
</script>

<style scoped>
.plans { padding: 16px; }
.toolbar { margin-bottom: 10px; display:flex; gap:8px; align-items:center }
</style>
