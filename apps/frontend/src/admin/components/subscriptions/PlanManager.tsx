'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Textarea } from '../ui/textarea'
import { Badge } from '../ui/badge'
import { Alert, AlertDescription } from '../ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs'
import { Separator } from '../ui/separator'
import { 
  Package, 
  Save, 
  RefreshCw, 
  TrendingUp, 
  Users,
  DollarSign,
  Settings,
  AlertTriangle,
  CheckCircle,
  Plus,
  Edit,
  Trash2,
  Eye,
  BarChart3,
  ArrowUpDown,
  Filter,
  Search
} from 'lucide-react'
import { toast } from 'sonner'

interface SubscriptionPlan {
  id: string
  name: string
  displayName: string
  description: string
  price: {
    monthly: number
    yearly: number
    currency: string
  }
  features: string[]
  tokenQuota: number
  limits: {
    maxRequestsPerMinute: number
    maxBatchSize: number
    siteRankDomains: number
    adsAccounts: number
  }
  status: string
  isPopular: boolean
  createdAt: string
  updatedAt: string
  extraTokenOptions?: {
    yearlyDiscount: number
    yearlyBonusTokens: number
  }
}

interface PlanComparison {
  planId: string
  planName: string
  subscribers: number
  revenue: number
  conversionRate: number
  churnRate: number
  avgLifetimeValue: number
}

interface SubscriptionAnalytics {
  totalSubscribers: number
  totalRevenue: number
  monthlyRecurringRevenue: number
  averageRevenuePerUser: number
  churnRate: number
  conversionRate: number
  planDistribution: Record<string, number>
  revenueByPlan: Record<string, number>
}

export default function PlanManager() {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([])
  const [analytics, setAnalytics] = useState<SubscriptionAnalytics | null>(null)
  const [planComparison, setPlanComparison] = useState<PlanComparison[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [sortBy, setSortBy] = useState<'name' | 'price' | 'subscribers'>('name')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'inactive'>('all')

  useEffect(() => {
    fetchPlans()
    fetchAnalytics()
  }, [])

  const fetchPlans = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/admin/plans')
      const data = await response.json()
      
      if (data.success) => {
        setPlans(data.data.plans)
        setPlanComparison(data.data.comparison || [])
      } else {
        toast.error('Failed to fetch subscription plans')
      }
    } catch (error) {
      console.error('Error fetching plans:', error)
      toast.error('Failed to fetch subscription plans')
    } finally {
      setLoading(false)
    }
  }

  const fetchAnalytics = async () => {
    try {
      const response = await fetch('/api/admin/subscriptions/analytics')
      const data = await response.json()
      
      if (data.success) => {
        setAnalytics(data.data)
      } else {
        toast.error('Failed to fetch subscription analytics')
      }
    } catch (error) {
      console.error('Error fetching analytics:', error)
      toast.error('Failed to fetch subscription analytics')
    }
  }

  const savePlan = async (plan: Partial<SubscriptionPlan>) => {
    try {
      setSaving(true)
      const url = plan.id ? `/api/admin/plans/${plan.id}` : '/api/admin/plans'
      const method = plan.id ? 'PUT' : 'POST'
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(plan)
      })

      const data = await response.json()
      
      if (data.success) => {
        await fetchPlans()
        await fetchAnalytics()
        setSelectedPlan(null)
        setShowCreateForm(false)
        toast.success(plan.id ? 'Plan updated successfully' : 'Plan created successfully')
      } else {
        toast.error(data.error || 'Failed to save plan')
      }
    } catch (error) {
      console.error('Error saving plan:', error)
      toast.error('Failed to save plan')
    } finally {
      setSaving(false)
    }
  }

  const deletePlan = async (planId: string) => {
    if (!confirm('Are you sure you want to delete this plan? This action cannot be undone.')) => {
      return
    }

    try {
      const response = await fetch(`/api/admin/plans/${planId}`, {
        method: 'DELETE'
      })

      const data = await response.json()
      
      if (data.success) => {
        await fetchPlans()
        await fetchAnalytics()
        toast.success('Plan deleted successfully')
      } else {
        toast.error(data.error || 'Failed to delete plan')
      }
    } catch (error) {
      console.error('Error deleting plan:', error)
      toast.error('Failed to delete plan')
    }
  }

  const togglePlanStatus = async (planId: string, status: string) => {
    try {
      const response = await fetch(`/api/admin/plans/${planId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status })
      })

      const data = await response.json()
      
      if (data.success) => {
        await fetchPlans()
        toast.success(`Plan ${status === 'ACTIVE' ? 'activated' : 'deactivated'} successfully`)
      } else {
        toast.error(data.error || 'Failed to update plan status')
      }
    } catch (error) {
      console.error('Error updating plan status:', error)
      toast.error('Failed to update plan status')
    }
  }

  const filteredPlans = plans
    .filter((plan: any) => {
      const matchesSearch = plan.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           plan.displayName.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesFilter = filterActive === 'all' || 
                           (filterActive === 'active' && plan.status === 'ACTIVE') ||
                           (filterActive === 'inactive' && plan.status !== 'ACTIVE')
      return matchesSearch && matchesFilter
    })
    .sort((a, b) => {
      let aValue: any, bValue: any
      
      switch (sortBy) => {
        case 'name':
          aValue = a.name
          bValue = b.name
          break
        case 'price':
          aValue = a.price.monthly
          bValue = b.price.monthly
          break
        case 'subscribers':
          const aComparison = planComparison.find((p: any) => p.planId === a.id)
          const bComparison = planComparison.find((p: any) => p.planId === b.id)
          aValue = aComparison?.subscribers || 0
          bValue = bComparison?.subscribers || 0
          break
        default:
          return 0
      }
      
      const multiplier = sortOrder === 'asc' ? 1 : -1
      return (aValue > bValue ? 1 : -1) * multiplier
    })

  if (loading) => {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Subscription Plan Management</h1>
          <p className="text-muted-foreground">
            Manage subscription plans, pricing, and analyze performance
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={fetchPlans}
            disabled={loading}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button
            onClick={((: any): any) => setShowCreateForm(true)}
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Plan
          </Button>
        </div>
      </div>

      {/* Analytics Overview */}
      {analytics && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Subscribers</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analytics.totalSubscribers.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                Active subscriptions
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Monthly Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${analytics.monthlyRecurringRevenue.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                MRR
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Average Revenue</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${analytics.averageRevenuePerUser.toFixed(0)}</div>
              <p className="text-xs text-muted-foreground">
                ARPU
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Churn Rate</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analytics.churnRate.toFixed(1)}%</div>
              <p className="text-xs text-muted-foreground">
                Monthly churn
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="plans" className="space-y-4">
        <TabsList>
          <TabsTrigger value="plans">
            <Package className="h-4 w-4 mr-2" />
            Plans
          </TabsTrigger>
          <TabsTrigger value="comparison">
            <BarChart3 className="h-4 w-4 mr-2" />
            Plan Comparison
          </TabsTrigger>
          <TabsTrigger value="analytics">
            <TrendingUp className="h-4 w-4 mr-2" />
            Analytics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="plans" className="space-y-4">
          {/* Filters and Search */}
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search plans..."
                value={searchTerm}
                onChange={((e: any): any) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <select
              value={filterActive}
              onChange={((e: any): any) => setFilterActive(e.target.value as any)}
              className="px-3 py-2 border rounded-md text-sm"
            >
              <option value="all">All Plans</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive Only</option>
            </select>
            
            <select
              value={`${sortBy}-${sortOrder}`}
              onChange={((e: any): any) => {
                const [field, order] = e.target.value.split('-')
                setSortBy(field as any)
                setSortOrder(order as any)
              }}
              className="px-3 py-2 border rounded-md text-sm"
            >
              <option value="name-asc">Name (A-Z)</option>
              <option value="name-desc">Name (Z-A)</option>
              <option value="price-asc">Price (Low to High)</option>
              <option value="price-desc">Price (High to Low)</option>
              <option value="subscribers-desc">Subscribers (High to Low)</option>
              <option value="subscribers-asc">Subscribers (Low to High)</option>
            </select>
          </div>

          {/* Plans Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPlans.map((plan: any) => {
              const comparison = planComparison.find((p: any) => p.planId === plan.id)
              
              return (
                <Card key={plan.id} className={`relative ${plan.isPopular ? 'ring-2 ring-blue-500' : ''}`}>
                  {plan.isPopular && (
                    <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                      <Badge className="bg-blue-500 text-white">Popular</Badge>
                    </div>
                  )}
                  
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        {plan.displayName}
                        {plan.status !== 'ACTIVE' && (
                          <Badge variant="secondary">Inactive</Badge>
                        )}
                      </CardTitle>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={((: any): any) => setSelectedPlan(plan)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={((: any): any) => deletePlan(plan.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <CardDescription>{plan.description}</CardDescription>
                  </CardHeader>
                  
                  <CardContent className="space-y-4">
                    <div>
                      <div className="text-3xl font-bold">
                        ${plan.price.monthly}
                        <span className="text-lg font-normal text-muted-foreground">/month</span>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        ${plan.price.yearly}/year 
                        {plan.extraTokenOptions?.yearlyDiscount && (
                          <span className="text-green-600 ml-1">
                            (年付优惠{Math.round(plan.extraTokenOptions.yearlyDiscount * 100)}%)
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <div>
                      <p className="text-sm font-medium mb-2">Features:</p>
                      <ul className="text-sm text-muted-foreground space-y-1">
                        {plan.features.slice(0, 3).map((feature, index: any) => (
                          <li key={index} className="flex items-center gap-2">
                            <CheckCircle className="h-3 w-3 text-green-500" />
                            {feature}
                          </li>
                        ))}
                        {plan.features.length > 3 && (
                          <li className="text-xs">+{plan.features.length - 3} more features</li>
                        )}
                      </ul>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Token Quota</p>
                        <p className="font-medium">{plan.tokenQuota.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Subscribers</p>
                        <p className="font-medium">{comparison?.subscribers || 0}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Button
                        variant={plan.status === 'ACTIVE' ? "outline" : "default"}
                        size="sm"
                        onClick={((: any): any) => togglePlanStatus(plan.id, plan.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE')}
                        className="flex-1"
                      >
                        {plan.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </TabsContent>

        <TabsContent value="comparison" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Plan Performance Comparison</CardTitle>
              <CardDescription>Compare key metrics across all subscription plans</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">Plan</th>
                      <th className="text-left p-2">Subscribers</th>
                      <th className="text-left p-2">Revenue</th>
                      <th className="text-left p-2">Conversion Rate</th>
                      <th className="text-left p-2">Churn Rate</th>
                      <th className="text-left p-2">Avg LTV</th>
                    </tr>
                  </thead>
                  <tbody>
                    {planComparison.map((comparison: any) => (
                      <tr key={comparison.planId} className="border-b">
                        <td className="p-2 font-medium">{comparison.planName}</td>
                        <td className="p-2">{comparison.subscribers.toLocaleString()}</td>
                        <td className="p-2">${comparison.revenue.toLocaleString()}</td>
                        <td className="p-2">{comparison.conversionRate.toFixed(1)}%</td>
                        <td className="p-2">{comparison.churnRate.toFixed(1)}%</td>
                        <td className="p-2">${comparison.avgLifetimeValue.toFixed(0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          {analytics && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Plan Distribution</CardTitle>
                  <CardDescription>Subscriber distribution across plans</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {Object.entries(analytics.planDistribution).map(([planName, count]: any) => {
                      const percentage = (count / analytics.totalSubscribers) * 100
                      return (
                        <div key={planName} className="space-y-2">
                          <div className="flex justify-between">
                            <span className="capitalize font-medium">{planName}</span>
                            <span className="text-sm text-muted-foreground">
                              {count} ({percentage.toFixed(1)}%)
                            </span>
                          </div>
                          <div className="bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-blue-600 h-2 rounded-full" 
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Revenue by Plan</CardTitle>
                  <CardDescription>Revenue contribution by plan</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {Object.entries(analytics.revenueByPlan).map(([planName, revenue]: any) => {
                      const percentage = (revenue / analytics.totalRevenue) * 100
                      return (
                        <div key={planName} className="space-y-2">
                          <div className="flex justify-between">
                            <span className="capitalize font-medium">{planName}</span>
                            <span className="text-sm text-muted-foreground">
                              ${revenue.toLocaleString()} ({percentage.toFixed(1)}%)
                            </span>
                          </div>
                          <div className="bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-green-600 h-2 rounded-full" 
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Plan Edit/Create Modal would go here */}
      {(selectedPlan || showCreateForm) && (
        <PlanEditModal
          plan={selectedPlan}
          onSave={savePlan}
          onClose={() => {
            setSelectedPlan(null)
            setShowCreateForm(false)
          }}
          saving={saving}
        />
      )}
    </div>
  )
}

// Plan Edit Modal Component
interface PlanEditModalProps {
  plan: SubscriptionPlan | null
  onSave: (plan: Partial<SubscriptionPlan>) => void
  onClose: () => void
  saving: boolean
}

function PlanEditModal({ plan, onSave, onClose, saving }: .*Props) {
  const [formData, setFormData] = useState<Partial<SubscriptionPlan>>(
    plan || {
      name: '',
      displayName: '',
      description: '',
      price: { monthly: 0, yearly: 0, currency: 'USD' },
      features: [],
      tokenQuota: 0,
      limits: { maxRequestsPerMinute: 60, maxBatchSize: 100, siteRankDomains: 0, adsAccounts: 0 },
      status: 'ACTIVE',
      isPopular: false
    }
  )

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave(formData)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">
            {plan ? 'Edit Plan' : 'Create New Plan'}
          </h2>
          <Button variant="ghost" onClick={onClose}>
            ×
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="name">Plan Name</Label>
              <Input
                id="name"
                value={formData.name || ''}
                onChange={((e: any): any) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
            <div>
              <Label htmlFor="displayName">Display Name</Label>
              <Input
                id="displayName"
                value={formData.displayName || ''}
                onChange={((e: any): any) => setFormData({ ...formData, displayName: e.target.value })}
                required
              />
            </div>
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description || ''}
              onChange={((e: any): any) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="monthlyPrice">Monthly Price ($)</Label>
              <Input
                id="monthlyPrice"
                type="number"
                value={formData.price?.monthly || 0}
                onChange={((e: any): any) => setFormData({
                  ...formData,
                  price: { ...formData.price!, monthly: parseFloat(e.target.value) || 0 }
                })}
                required
              />
            </div>
            <div>
              <Label htmlFor="yearlyPrice">Yearly Price ($)</Label>
              <Input
                id="yearlyPrice"
                type="number"
                value={formData.price?.yearly || 0}
                onChange={((e: any): any) => setFormData({
                  ...formData,
                  price: { ...formData.price!, yearly: parseFloat(e.target.value) || 0 }
                })}
                required
              />
            </div>
          </div>

          <div>
            <Label htmlFor="tokenQuota">Token Quota</Label>
            <Input
              id="tokenQuota"
              type="number"
              value={formData.tokenQuota || 0}
              onChange={((e: any): any) => setFormData({ ...formData, tokenQuota: parseInt(e.target.value) || 0 })}
              required
            />
          </div>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.status === 'ACTIVE' || false}
                onChange={((e: any): any) => setFormData({ ...formData, status: e.target.checked ? 'ACTIVE' : 'INACTIVE' })}
              />
              Active
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.isPopular || false}
                onChange={((e: any): any) => setFormData({ ...formData, isPopular: e.target.checked })}
              />
              Popular
            </label>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving...' : 'Save Plan'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}