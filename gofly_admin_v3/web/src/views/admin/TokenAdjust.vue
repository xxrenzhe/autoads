<template>
  <div class="token-adjust">
    <h2>余额调整</h2>
    <div class="form">
      <a-input v-model:value="userId" placeholder="用户ID" />
      <a-input-number v-model:value="amount" :min="-1000000" :max="1000000" placeholder="正为加，负为减" />
      <a-input v-model:value="reason" placeholder="原因（必填）" />
      <a-input v-model:value="service" placeholder="服务(可选)" />
      <a-input v-model:value="action" placeholder="动作(可选)" />
      <a-input v-model:value="refId" placeholder="关联ID(可选)" />
      <a-button type="primary" @click="submit" :loading="loading">提交</a-button>
    </div>
  </div>
</template>

<script>
import { ref } from 'vue'
import { tokenApi } from '@/api/admin/tokens'
import { message } from 'ant-design-vue'
export default { name: 'TokenAdjust', setup() {
  const userId = ref('')
  const amount = ref(0)
  const reason = ref('')
  const service = ref('')
  const action = ref('')
  const refId = ref('')
  const loading = ref(false)
  const submit = async () => { if (!userId.value || !amount.value || !reason.value) { message.warning('请填写用户ID、金额与原因'); return } ; loading.value=true; try { await tokenApi.adjust(userId.value, { amount: amount.value, reason: reason.value, service: service.value, action: action.value, ref_id: refId.value }); message.success('已调整'); amount.value=0; reason.value=''; } catch (e) { message.error('调整失败') } finally { loading.value=false } }
  return { userId, amount, reason, service, action, refId, loading, submit }
} }
</script>

<style scoped>
.token-adjust { padding: 16px; }
.form { display:grid; grid-template-columns: repeat(3,minmax(0,1fr)); gap:8px; max-width: 880px }
</style>
