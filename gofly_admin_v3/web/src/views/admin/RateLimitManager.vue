# 速率限制管理页面

<template>
  <div class="rate-limit-manager">
    <!-- 页面标题 -->
    <div class="page-header">
      <h2>速率限制管理</h2>
      <p>管理系统各模块的速率限制配置和用户使用情况</p>
    </div>

    <!-- 套餐配置管理 -->
    <a-card title="套餐限制配置" class="config-card">
      <a-table
        :columns="planColumns"
        :data-source="planConfigs"
        :loading="loading"
        :pagination="false"
        row-key="plan"
      >
        <template #bodyCell="{ column, record, index }">
          <template v-if="column.key === 'plan'">
            <a-tag :color="getPlanColor(record.plan)">
              {{ record.plan }}
            </a-tag>
          </template>
          
          <template v-else-if="column.key === 'api_per_minute'">
            <a-input-number
              v-model:value="record.api_requests_per_minute"
              :min="1"
              :max="10000"
              size="small"
              style="width: 120px"
            />
          </template>
          
          <template v-else-if="column.key === 'api_per_hour'">
            <a-input-number
              v-model:value="record.api_requests_per_hour"
              :min="1"
              :max="100000"
              size="small"
              style="width: 120px"
            />
          </template>
          
          <template v-else-if="column.key === 'siterank_per_minute'">
            <a-input-number
              v-model:value="record.site_rank_requests_per_minute"
              :min="1"
              :max="1000"
              size="small"
              style="width: 120px"
            />
          </template>
          
          <template v-else-if="column.key === 'siterank_per_hour'">
            <a-input-number
              v-model:value="record.site_rank_requests_per_hour"
              :min="1"
              :max="10000"
              size="small"
              style="width: 120px"
            />
          </template>
          
          <template v-else-if="column.key === 'batch_concurrent'">
            <a-input-number
              v-model:value="record.batch_concurrent_tasks"
              :min="1"
              :max="100"
              size="small"
              style="width: 120px"
            />
          </template>
          
          <template v-else-if="column.key === 'batch_per_minute'">
            <a-input-number
              v-model:value="record.batch_tasks_per_minute"
              :min="1"
              :max="1000"
              size="small"
              style="width: 120px"
            />
          </template>
          
          <template v-else-if="column.key === 'action'">
            <a-button
              type="primary"
              size="small"
              :loading="updating[record.plan]"
              @click="updatePlanConfig(record)"
            >
              保存
            </a-button>
          </template>
        </template>
      </a-table>
    </a-card>

    <!-- 系统统计 -->
    <a-row :gutter="16" class="stats-row">
      <a-col :span="8">
        <a-card>
          <a-statistic
            title="活跃用户数"
            :value="systemStats.total_active_users || 0"
            :value-style="{ color: '#3f8600' }"
          >
            <template #prefix>
              <user-outlined />
            </template>
          </a-statistic>
        </a-card>
      </a-col>
      <a-col :span="8">
        <a-card>
          <a-statistic
            title="系统QPS限制"
            :value="systemStats.system_limits?.global_requests_per_second || 0"
            suffix="/秒"
            :value-style="{ color: '#1890ff' }"
          >
            <template #prefix>
              <thunderbolt-outlined />
            </template>
          </a-statistic>
        </a-card>
      </a-col>
      <a-col :span="8">
        <a-card>
          <a-statistic
            title="最大并发用户"
            :value="systemStats.system_limits?.max_concurrent_users || 0"
            :value-style="{ color: '#cf1322' }"
          >
            <template #prefix>
              <cluster-outlined />
            </template>
          </a-statistic>
        </a-card>
      </a-col>
    </a-row>

    <!-- 用户限流统计 -->
    <a-card title="活跃限流器" class="active-limiters-card">
      <a-row :gutter="16" class="filter-row">
        <a-col :span="6">
          <a-input-search
            v-model:value="searchUserId"
            placeholder="搜索用户ID"
            @search="loadActiveLimiters"
          />
        </a-col>
        <a-col :span="6">
          <a-select
            v-model:value="selectedPlan"
            placeholder="选择套餐"
            allow-clear
            @change="loadActiveLimiters"
          >
            <a-select-option value="FREE">FREE</a-select-option>
            <a-select-option value="PRO">PRO</a-select-option>
            <a-select-option value="MAX">MAX</a-select-option>
          </a-select>
        </a-col>
        <a-col :span="6">
          <a-button @click="refreshAll">
            <template #icon><reload-outlined /></template>
            刷新
          </a-button>
        </a-col>
      </a-row>
      
      <a-table
        :columns="limiterColumns"
        :data-source="activeLimiters"
        :loading="loadingLimiters"
        :pagination="pagination"
        @change="handleTableChange"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'plan'">
            <a-tag :color="getPlanColor(record.plan)">
              {{ record.plan }}
            </a-tag>
          </template>
          
          <template v-else-if="column.key === 'tokens_available'">
            <a-progress
              :percent="Math.round((record.tokens_available / 5) * 100)"
              size="small"
              :show-info="false"
            />
            <span>{{ record.tokens_available }}/5</span>
          </template>
          
          <template v-else-if="column.key === 'last_active'">
            {{ formatTime(record.last_active) }}
          </template>
          
          <template v-else-if="column.key === 'action'">
            <a-popconfirm
              title="确定要重置该用户的限流器吗？"
              @confirm="resetUserLimiter(record.user_id)"
            >
              <a-button
                type="link"
                size="small"
                :loading="resetting[record.user_id]"
              >
                重置
              </a-button>
            </a-popconfirm>
          </template>
        </template>
      </a-table>
    </a-card>

    <!-- 用户使用统计 -->
    <a-card title="用户使用统计" class="usage-stats-card">
      <a-form layout="inline" :model="statsForm">
        <a-form-item label="用户ID">
          <a-input
            v-model:value="statsForm.userId"
            placeholder="输入用户ID"
            style="width: 200px"
          />
        </a-form-item>
        <a-form-item label="统计天数">
          <a-select v-model:value="statsForm.days" style="width: 120px">
            <a-select-option :value="1">最近1天</a-select-option>
            <a-select-option :value="7">最近7天</a-select-option>
            <a-select-option :value="30">最近30天</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item>
          <a-button
            type="primary"
            :loading="loadingStats"
            @click="loadUserStats"
          >
            查询
          </a-button>
        </a-form-item>
      </a-form>
      
      <div v-if="userStats" class="stats-content">
        <a-row :gutter="16">
          <a-col :span="8" v-for="(usage, feature) in userStats.usage" :key="feature">
            <a-card :title="getFeatureName(feature)">
              <a-statistic
                v-if="usage.MINUTE !== undefined"
                title="每分钟使用"
                :value="usage.MINUTE"
                :value-style="{ color: '#1890ff' }"
              />
              <a-statistic
                v-if="usage.HOUR !== undefined"
                title="每小时使用"
                :value="usage.HOUR"
                :value-style="{ color: '#52c41a' }"
              />
            </a-card>
          </a-col>
        </a-row>
        
        <a-divider />
        
        <h4>当前限制</h4>
        <a-descriptions bordered>
          <a-descriptions-item label="API每分钟限制">
            {{ userStats.limits.api_per_minute }}
          </a-descriptions-item>
          <a-descriptions-item label="API每小时限制">
            {{ userStats.limits.api_per_hour }}
          </a-descriptions-item>
          <a-descriptions-item label="SiteRank每分钟限制">
            {{ userStats.limits.siterank_per_minute }}
          </a-descriptions-item>
          <a-descriptions-item label="SiteRank每小时限制">
            {{ userStats.limits.siterank_per_hour }}
          </a-descriptions-item>
          <a-descriptions-item label="Batch每分钟限制">
            {{ userStats.limits.batch_per_minute }}
          </a-descriptions-item>
          <a-descriptions-item label="Batch并发限制">
            {{ userStats.limits.batch_concurrent }}
          </a-descriptions-item>
        </a-descriptions>
      </div>
    </a-card>
  </div>
</template>

<script>
import { ref, reactive, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import {
  UserOutlined,
  ThunderboltOutlined,
  ClusterOutlined,
  ReloadOutlined
} from '@ant-design/icons-vue'
import { rateLimitApi } from '@/api/admin'

export default {
  name: 'RateLimitManager',
  components: {
    UserOutlined,
    ThunderboltOutlined,
    ClusterOutlined,
    ReloadOutlined
  },
  setup() {
    const loading = ref(false)
    const loadingLimiters = ref(false)
    const loadingStats = ref(false)
    const planConfigs = ref([])
    const systemStats = ref({})
    const activeLimiters = ref([])
    const userStats = ref(null)
    const searchUserId = ref('')
    const selectedPlan = ref('')
    
    const updating = reactive({})
    const resetting = reactive({})
    
    const pagination = reactive({
      current: 1,
      pageSize: 20,
      total: 0,
      showSizeChanger: true,
      showQuickJumper: true
    })
    
    const statsForm = reactive({
      userId: '',
      days: 7
    })
    
    const planColumns = [
      {
        title: '套餐',
        key: 'plan',
        width: 100
      },
      {
        title: 'API限制(分钟)',
        key: 'api_per_minute',
        width: 150
      },
      {
        title: 'API限制(小时)',
        key: 'api_per_hour',
        width: 150
      },
      {
        title: 'SiteRank限制(分钟)',
        key: 'siterank_per_minute',
        width: 150
      },
      {
        title: 'SiteRank限制(小时)',
        key: 'siterank_per_hour',
        width: 150
      },
      {
        title: 'Batch并发数',
        key: 'batch_concurrent',
        width: 150
      },
      {
        title: 'Batch限制(分钟)',
        key: 'batch_per_minute',
        width: 150
      },
      {
        title: '操作',
        key: 'action',
        width: 100,
        fixed: 'right'
      }
    ]
    
    const limiterColumns = [
      {
        title: '用户ID',
        dataIndex: 'user_id',
        key: 'user_id',
        width: 200
      },
      {
        title: '套餐',
        key: 'plan',
        width: 100
      },
      {
        title: '小时计数',
        dataIndex: 'hourly_count',
        key: 'hourly_count',
        width: 120
      },
      {
        title: '可用令牌',
        key: 'tokens_available',
        width: 150
      },
      {
        title: '最后活跃',
        key: 'last_active',
        width: 180
      },
      {
        title: '操作',
        key: 'action',
        width: 100,
        fixed: 'right'
      }
    ]
    
    // 加载套餐配置
    const loadPlanConfigs = async () => {
      loading.value = true
      try {
        const response = await rateLimitApi.getPlanLimits()
        planConfigs.value = Object.entries(response.data).map(([plan, config]) => ({
          plan,
          ...config
        }))
      } catch (error) {
        message.error('加载套餐配置失败')
      } finally {
        loading.value = false
      }
    }
    
    // 加载系统统计
    const loadSystemStats = async () => {
      try {
        const response = await rateLimitApi.getSystemStats()
        systemStats.value = response.data
      } catch (error) {
        message.error('加载系统统计失败')
      }
    }
    
    // 加载活跃限流器
    const loadActiveLimiters = async () => {
      loadingLimiters.value = true
      try {
        const params = {
          page: pagination.current,
          size: pagination.pageSize
        }
        if (searchUserId.value) {
          params.search = searchUserId.value
        }
        if (selectedPlan.value) {
          params.plan = selectedPlan.value
        }
        
        const response = await rateLimitApi.getActiveLimiters(params)
        activeLimiters.value = response.data.items
        pagination.total = response.data.total
      } catch (error) {
        message.error('加载活跃限流器失败')
      } finally {
        loadingLimiters.value = false
      }
    }
    
    // 更新套餐配置
    const updatePlanConfig = async (config) => {
      updating[config.plan] = true
      try {
        await rateLimitApi.updatePlanLimit(config.plan, config)
        message.success('配置更新成功')
      } catch (error) {
        message.error('配置更新失败')
      } finally {
        updating[config.plan] = false
      }
    }
    
    // 重置用户限流器
    const resetUserLimiter = async (userId) => {
      resetting[userId] = true
      try {
        await rateLimitApi.resetUserLimiter(userId)
        message.success('重置成功')
        loadActiveLimiters()
      } catch (error) {
        message.error('重置失败')
      } finally {
        resetting[userId] = false
      }
    }
    
    // 加载用户统计
    const loadUserStats = async () => {
      if (!statsForm.userId) {
        message.warning('请输入用户ID')
        return
      }
      
      loadingStats.value = true
      try {
        const response = await rateLimitApi.getUserStats(statsForm.userId, {
          days: statsForm.days
        })
        userStats.value = response.data
      } catch (error) {
        message.error('加载用户统计失败')
      } finally {
        loadingStats.value = false
      }
    }
    
    // 获取套餐颜色
    const getPlanColor = (plan) => {
      const colors = {
        FREE: 'default',
        PRO: 'blue',
        MAX: 'gold'
      }
      return colors[plan] || 'default'
    }
    
    // 获取功能名称
    const getFeatureName = (feature) => {
      const names = {
        API: 'API调用',
        SITE_RANK: '网站排名',
        BATCH: '批量任务'
      }
      return names[feature] || feature
    }
    
    // 格式化时间
    const formatTime = (time) => {
      if (!time) return '-'
      return new Date(time).toLocaleString()
    }
    
    // 表格变化处理
    const handleTableChange = (pag) => {
      pagination.current = pag.current
      pagination.pageSize = pag.pageSize
      loadActiveLimiters()
    }
    
    // 刷新所有数据
    const refreshAll = () => {
      loadPlanConfigs()
      loadSystemStats()
      loadActiveLimiters()
    }
    
    onMounted(() => {
      loadPlanConfigs()
      loadSystemStats()
      loadActiveLimiters()
    })
    
    return {
      loading,
      loadingLimiters,
      loadingStats,
      planConfigs,
      systemStats,
      activeLimiters,
      userStats,
      searchUserId,
      selectedPlan,
      updating,
      resetting,
      pagination,
      statsForm,
      planColumns,
      limiterColumns,
      loadPlanConfigs,
      loadSystemStats,
      loadActiveLimiters,
      updatePlanConfig,
      resetUserLimiter,
      loadUserStats,
      getPlanColor,
      getFeatureName,
      formatTime,
      handleTableChange,
      refreshAll
    }
  }
}
</script>

<style scoped>
.rate-limit-manager {
  padding: 24px;
}

.page-header {
  margin-bottom: 24px;
}

.page-header h2 {
  margin-bottom: 8px;
}

.page-header p {
  color: rgba(0, 0, 0, 0.45);
}

.config-card {
  margin-bottom: 24px;
}

.stats-row {
  margin-bottom: 24px;
}

.filter-row {
  margin-bottom: 16px;
}

.active-limiters-card,
.usage-stats-card {
  margin-bottom: 24px;
}

.stats-content {
  margin-top: 24px;
}
</style>