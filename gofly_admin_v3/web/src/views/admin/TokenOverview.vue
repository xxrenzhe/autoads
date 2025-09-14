<template>
  <div class="token-overview">
    <h2>Token 总览</h2>
    <div class="toolbar">
      <a-input v-model:value="userId" placeholder="用户ID" style="width:260px" />
      <a-button type="primary" @click="load">查询余额</a-button>
      <span v-if="balance!==null">当前余额：<b>{{ balance }}</b></span>
    </div>
  </div>
</template>

<script>
import { ref } from 'vue'
import { tokenApi } from '@/api/admin/tokens'
import { message } from 'ant-design-vue'
export default { name: 'TokenOverview', setup() {
  const userId = ref('')
  const balance = ref(null)
  const load = async () => { if (!userId.value) { message.warning('请输入用户ID'); return } const r = await tokenApi.getBalance(userId.value); if (r.code===0) balance.value = r.data.balance }
  return { userId, balance, load }
} }
</script>

<style scoped>
.token-overview { padding: 16px; }
.toolbar { display:flex; gap:8px; align-items:center }
</style>

