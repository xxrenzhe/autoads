'use client'

import { useState, useEffect } from 'react'
import { DataGrid, GridColDef, GridRenderCellParams } from '@mui/x-data-grid'
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Switch,
  TextField,
  Typography,
  Alert,
  Tab,
  Tabs
} from '@mui/material'
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Save as SaveIcon,
  Cancel as CancelIcon
} from '@mui/icons-material'
import { PlanFeaturesService } from '@/lib/services/plan-features-service'
import { FeaturePermissionService } from '@/lib/services/feature-permission-service'

interface PlanFeature {
  id: string
  planId: string
  featureId: string
  name: string
  description: string
  enabled: boolean
  value?: number
  unit?: string
  type?: string
  config: any
}

interface SubscriptionPlan {
  id: string
  name: string
  description: string
  price: number
  currency: string
  status: string
  features: PlanFeature[]
}

interface FeaturePermission {
  featureId: string
  name: string
  description: string
  requiredPlan: string
  requiredPermissions: string[]
  limits?: Record<string, any>
}

const planNames = {
  free: '免费套餐',
  pro: '高级套餐',
  max: '白金套餐'
}

export default function SubscriptionPermissionsPage() {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([])
  const [features, setFeatures] = useState<FeaturePermission[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedTab, setSelectedTab] = useState(0)
  const [editDialog, setEditDialog] = useState<{
    open: boolean
    plan?: SubscriptionPlan
    feature?: PlanFeature
    mode: 'create' | 'edit'
  }>({ open: false, mode: 'create' })

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)

      // Load features
      const allFeatures = FeaturePermissionService.getAllFeatures()
      setFeatures(allFeatures)

      // Load plans (this would be an API call in production)
      const mockPlans: SubscriptionPlan[] = [
        {
          id: 'free',
          name: '免费套餐',
          description: '基础功能体验',
          price: 0,
          currency: 'CNY',
          status: 'ACTIVE',
          features: []
        },
        {
          id: 'pro',
          name: '高级套餐',
          description: '专业功能支持',
          price: 298,
          currency: 'CNY',
          status: 'ACTIVE',
          features: []
        },
        {
          id: 'max',
          name: '白金套餐',
          description: '企业级功能',
          price: 998,
          currency: 'CNY',
          status: 'ACTIVE',
          features: []
        }
      ]
      setPlans(mockPlans)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }

  const handleFeatureToggle = async (planId: string, featureId: string, enabled: boolean) => {
    try {
      // In production, this would be an API call
      setPlans(prev => prev.map(plan => {
        if (plan.id === planId) {
          const existingFeature = plan.features.find(f => f.featureId === featureId)
          if (existingFeature) {
            return {
              ...plan,
              features: plan.features.map(f => 
                f.featureId === featureId ? { ...f, enabled } : f
              )
            }
          } else if (enabled) {
            // Add new feature
            const featureDef = features.find(f => f.featureId === featureId)
            if (featureDef) {
              return {
                ...plan,
                features: [...plan.features, {
                  id: `${planId}_${featureId}`,
                  planId,
                  featureId,
                  name: featureDef.name,
                  description: featureDef.description,
                  enabled: true,
                  config: featureDef.limits || {}
                }]
              }
            }
          }
        }
        return plan
      }))
    } catch (err) {
      setError(err instanceof Error ? err.message : '更新失败')
    }
  }

  const handleFeatureLimitChange = async (
    planId: string, 
    featureId: string, 
    limitKey: string, 
    value: any
  ) => {
    try {
      setPlans(prev => prev.map(plan => {
        if (plan.id === planId) {
          return {
            ...plan,
            features: plan.features.map(feature => {
              if (feature.featureId === featureId) {
                return {
                  ...feature,
                  config: {
                    ...feature.config,
                    [limitKey]: value
                  }
                }
              }
              return feature
            })
          }
        }
        return plan
      }))
    } catch (err) {
      setError(err instanceof Error ? err.message : '更新失败')
    }
  }

  const featureColumns: GridColDef[] = [
    { field: 'featureId', headerName: '功能ID', width: 150 },
    { field: 'name', headerName: '功能名称', width: 200 },
    { field: 'description', headerName: '描述', width: 300 },
    { 
      field: 'requiredPlan', 
      headerName: '最低套餐', 
      width: 120,
      renderCell: (params: GridRenderCellParams) => (
        <Chip 
          label={planNames[params.value as keyof typeof planNames] || params.value} 
          color={params.value === 'free' ? 'default' : params.value === 'pro' ? 'primary' : 'secondary'}
          size="small"
        />
      )
    },
    {
      field: 'limits',
      headerName: '限制',
      width: 300,
      renderCell: (params: GridRenderCellParams) => {
        const limits = params.value as Record<string, any>
        if (!limits || Object.keys(limits).length === 0) {
          return <span>无限制</span>
        }
        
        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {Object.entries(limits).map(([key, value]) => (
              <Typography key={key} variant="body2" sx={{ fontSize: '0.8rem' }}>
                {key}: {String(value)}
              </Typography>
            ))}
          </Box>
        )
      }
    }
  ]

  const planFeatureColumns: GridColDef[] = [
    { field: 'name', headerName: '功能名称', width: 200 },
    { field: 'description', headerName: '描述', width: 300 },
    {
      field: 'enabled',
      headerName: '启用状态',
      width: 120,
      renderCell: (params: GridRenderCellParams<any>) => (
        <Switch
          checked={params.value}
          onChange={(e) => {
            const planId = plans[selectedTab]?.id
            if (planId && params.row.featureId) {
              handleFeatureToggle(planId, params.row.featureId, e.target.checked)
            }
          }}
        />
      )
    },
    {
      field: 'config',
      headerName: '配置',
      width: 400,
      renderCell: (params: GridRenderCellParams<any>) => {
        const config = params.value as Record<string, any> || {}
        const planId = plans[selectedTab]?.id
        const featureId = params.row.featureId
        
        if (!planId || !featureId) return null
        
        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {Object.entries(config).map(([key, value]) => (
              <Box key={key} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="body2" sx={{ minWidth: 100 }}>
                  {key}:
                </Typography>
                <TextField
                  size="small"
                  value={value}
                  onChange={(e) => handleFeatureLimitChange(planId, featureId, key, e.target.value)}
                  sx={{ width: 100 }}
                />
              </Box>
            ))}
          </Box>
        )
      }
    }
  ]

  if (loading) {
    return <div>加载中...</div>
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        套餐权限管理
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Tabs 
          value={selectedTab} 
          onChange={(e, newValue) => setSelectedTab(newValue)}
        >
          {plans.map((plan) => (
            <Tab 
              key={plan.id} 
              label={`${plan.name} (${plan.price === 0 ? '免费' : `¥${plan.price}`})`} 
            />
          ))}
        </Tabs>
      </Box>

      {selectedTab < plans.length && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              {plans[selectedTab].name} - 功能配置
            </Typography>
            
            <Box sx={{ height: 600, mt: 2 }}>
              <DataGrid
                rows={features.map(feature => {
                  const planFeature = plans[selectedTab].features.find(
                    f => f.featureId === feature.featureId
                  )
                  return {
                    id: feature.featureId,
                    ...feature,
                    ...planFeature,
                    enabled: planFeature?.enabled || false,
                    config: planFeature?.config || feature.limits || {}
                  }
                })}
                columns={planFeatureColumns}
                pagination
                disableSelectionOnClick
              />
            </Box>
          </CardContent>
        </Card>
      )}

      <Card sx={{ mt: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            所有功能定义
          </Typography>
          
          <Box sx={{ height: 600, mt: 2 }}>
            <DataGrid
              rows={features}
              columns={featureColumns}
              pagination
              disableSelectionOnClick
            />
          </Box>
        </CardContent>
      </Card>
    </Box>
  )
}