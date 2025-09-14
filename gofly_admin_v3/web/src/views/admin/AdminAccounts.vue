<template>
  <div class="admins">
    <h2>管理员账号</h2>
    <div class="form">
      <a-input v-model:value="form.username" placeholder="用户名" />
      <a-input v-model:value="form.email" placeholder="邮箱" />
      <a-input v-model:value="form.password" placeholder="初始密码" />
      <a-select v-model:value="form.role" style="width:160px">
        <a-select-option v-for="r in roles" :key="r.value" :value="r.value">{{ r.label }}</a-select-option>
      </a-select>
      <a-button type="primary" @click="create" :loading="loading">创建</a-button>
    </div>
    <a-table :data-source="items" :columns="columns" rowKey="id" :loading="loading">
      <template #bodyCell="{ column, record }">
        <template v-if="column.key==='action'">
          <a-space>
            <a-popconfirm title="删除该管理员？" @confirm="remove(record)"><a-button size="small" danger>删除</a-button></a-popconfirm>
          </a-space>
        </template>
      </template>
    </a-table>
  </div>
</template>

<script>
import { ref, onMounted } from 'vue'
import { adminsApi } from '@/api/admin/admins'
import { message } from 'ant-design-vue'
export default { name:'AdminAccounts', setup() {
  const items = ref([])
  const roles = ref([])
  const loading = ref(false)
  const form = ref({ username:'', email:'', password:'', role:'admin' })
  const columns = [
    { title:'用户名', dataIndex:'username', key:'username' },
    { title:'邮箱', dataIndex:'email', key:'email' },
    { title:'角色', dataIndex:'role', key:'role', width:120 },
    { title:'状态', dataIndex:'is_active', key:'is_active', width:120 },
    { title:'上次登录', dataIndex:'last_login_at', key:'last_login_at', width:180 },
    { title:'操作', key:'action', width:140 }
  ]
  const load = async () => { loading.value=true; try { const r = await adminsApi.list(); if (r.code===0) items.value = r.data||[] ; const ro = await adminsApi.roles(); if (ro.code===0) roles.value = ro.data||[] } catch { message.error('加载失败') } finally { loading.value=false } }
  const create = async () => { loading.value=true; try { if (!form.value.username || !form.value.email || !form.value.password) { message.warning('填写完整'); return } await adminsApi.create(form.value); message.success('已创建'); form.value={ username:'', email:'', password:'', role:'admin'}; load() } catch { message.error('创建失败') } finally { loading.value=false } }
  const remove = async (r) => { loading.value=true; try { await adminsApi.remove(r.id); message.success('已删除'); load() } catch { message.error('删除失败') } finally { loading.value=false } }
  onMounted(load)
  return { items, roles, loading, form, columns, create, remove }
} }
</script>

<style scoped>
.admins { padding: 16px }
.form { display:grid; grid-template-columns: repeat(5,minmax(0,1fr)); gap:8px; max-width: 960px; margin-bottom: 12px }
</style>

