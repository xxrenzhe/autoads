'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Badge } from '../ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs'
import { 
  Shield, 
  RefreshCw, 
  Plus,
  Edit,
  Trash2,
  AlertTriangle,
  CheckCircle,
  Clock,
  BarChart3,
  Search,
  X
} from 'lucide-react'
import { toast } from 'sonner'

interface RateLimitRule {
  id: string
  name: string
  endpoint: string
  method: string
  userRole: string
  requestsPerMinute: number
  requestsPerHour: number
  requestsPerDay: number
  isActive: boolean
  priority: number
  description?: string
  createdAt: string
  updatedAt: string
}

interface RateLimitStats {
  totalRules: number
  activeRules: number
  totalBlocked: number
  blockedToday: number
  topBlockedEndpoints: Array<{
    endpoint: string
    blocked: number
  }>
  rateLimitHits: Array<{
    endpoint: string
    userRole: string
    hits: number
    timestamp: string
  }>
}

const USER_ROLES = [
  { value: 'all', label: 'All Users' },
  { value: 'FREE', label: 'Free Users' },
  { value: 'PRO', label: 'Pro Users' },
  { value: 'MAX', label: 'Max Users' },
  { value: 'ADMIN', label: 'Administrators' }
]

const HTTP_METHODS = [
  { value: 'ALL', label: 'All Methods' },
  { value: 'GET', label: 'GET' },
  { value: 'POST', label: 'POST' },
  { value: 'PUT', label: 'PUT' },
  { value: 'DELETE', label: 'DELETE' },
  { value: 'PATCH', label: 'PATCH' }
]

export default function APIRateLimitManager() {
  const [rules, setRules] = useState<RateLimitRule[]>([])
  const [stats, setStats] = useState<RateLimitStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [selectedRule, setSelectedRule] = useState<RateLimitRule | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterRole, setFilterRole] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all')
  
  // Accessibility refs
  const searchInputRef = useRef<HTMLInputElement>(null)
  const modalRef = useRef<HTMLDivElement>(null)
  const statusAnnouncementRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchRateLimitData()
  }, [])

  // Function to announce status changes to screen readers
  const announceToScreenReader = (message: string) => {
    if (statusAnnouncementRef.current) {
      statusAnnouncementRef.current.textContent = message
      // Clear after a delay to allow for re-announcements
      setTimeout(() => {
        if (statusAnnouncementRef.current) {
          statusAnnouncementRef.current.textContent = ''
        }
      }, 1000)
    }
  }

  const fetchRateLimitData = async () => {
    try {
      setLoading(true)
      
      const [rulesResponse, statsResponse] = await Promise.all([
        fetch('/api/admin/api-management/rate-limits'),
        fetch('/api/admin/api-management/rate-limit-stats')
      ])

      if (rulesResponse.ok) {
        const data = await rulesResponse.json()
        setRules(data.data || [])
      }

      if (statsResponse.ok) {
        const data = await statsResponse.json()
        setStats(data.data)
      }
    } catch (error) {
      console.error('Error fetching rate limit data:', error)
      toast.error('Failed to fetch rate limit data')
    } finally {
      setLoading(false)
    }
  }

  const saveRule = async (rule: Partial<RateLimitRule>) => {
    try {
      setSaving(true)
      const url = rule.id ? `/api/admin/api-management/rate-limits/${rule.id}` : '/api/admin/api-management/rate-limits'
      const method = rule.id ? 'PUT' : 'POST'
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(rule)
      })

      const data = await response.json()
      
      if (data.success) {
        await fetchRateLimitData()
        setSelectedRule(null)
        setShowCreateForm(false)
        const successMessage = rule.id ? 'Rate limit rule updated successfully' : 'Rate limit rule created successfully'
        toast.success(successMessage)
        announceToScreenReader(successMessage)
      } else {
        const errorMessage = data.error || 'Failed to save rate limit rule'
        toast.error(errorMessage)
        announceToScreenReader(errorMessage)
      }
    } catch (error) {
      console.error('Error saving rate limit rule:', error)
      toast.error('Failed to save rate limit rule')
    } finally {
      setSaving(false)
    }
  }

  const deleteRule = async (ruleId: string) => {
    if (!confirm('Are you sure you want to delete this rate limit rule?')) {
      return
    }

    try {
      const response = await fetch(`/api/admin/api-management/rate-limits/${ruleId}`, {
        method: 'DELETE'
      })

      const data = await response.json()
      
      if (data.success) {
        await fetchRateLimitData()
        const successMessage = 'Rate limit rule deleted successfully'
        toast.success(successMessage)
        announceToScreenReader(successMessage)
      } else {
        const errorMessage = data.error || 'Failed to delete rate limit rule'
        toast.error(errorMessage)
        announceToScreenReader(errorMessage)
      }
    } catch (error) {
      console.error('Error deleting rate limit rule:', error)
      toast.error('Failed to delete rate limit rule')
    }
  }

  const toggleRuleStatus = async (ruleId: string, isActive: boolean) => {
    try {
      const response = await fetch(`/api/admin/api-management/rate-limits/${ruleId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ isActive })
      })

      const data = await response.json()
      
      if (data.success) {
        await fetchRateLimitData()
        const successMessage = `Rate limit rule ${isActive ? 'activated' : 'deactivated'} successfully`
        toast.success(successMessage)
        announceToScreenReader(successMessage)
      } else {
        const errorMessage = data.error || 'Failed to update rate limit rule status'
        toast.error(errorMessage)
        announceToScreenReader(errorMessage)
      }
    } catch (error) {
      console.error('Error updating rate limit rule status:', error)
      toast.error('Failed to update rate limit rule status')
    }
  }

  const filteredRules = rules.filter((rule: any) => {
    const matchesSearch = rule.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         rule.endpoint.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesRole = filterRole === 'all' || rule.userRole === filterRole
    const matchesStatus = filterStatus === 'all' || 
                         (filterStatus === 'active' && rule.isActive) ||
                         (filterStatus === 'inactive' && !rule.isActive)
    return matchesSearch && matchesRole && matchesStatus
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8" role="status" aria-live="polite">
        <RefreshCw className="h-8 w-8 animate-spin" aria-hidden="true" />
        <span className="sr-only">Loading rate limit data...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Status announcements for screen readers */}
      <div 
        ref={statusAnnouncementRef}
        className="sr-only" 
        role="status" 
        aria-live="polite" 
        aria-atomic="true"
      />
      
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">API Rate Limiting</h1>
          <p className="text-muted-foreground">
            Configure and monitor API rate limits by endpoint and user role
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={fetchRateLimitData}
            disabled={loading}
            aria-label="Refresh rate limit data"
          >
            <RefreshCw className="h-4 w-4 mr-2" aria-hidden="true" />
            Refresh
          </Button>
          <Button
            onClick={((: any): any) => setShowCreateForm(true)}
            aria-label="Create new rate limit rule"
          >
            <Plus className="h-4 w-4 mr-2" aria-hidden="true" />
            Create Rule
          </Button>
        </div>
      </header>

      {/* Stats Cards */}
      {stats && (
        <section aria-labelledby="stats-heading">
          <h2 id="stats-heading" className="sr-only">Rate Limiting Statistics</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Rules</CardTitle>
                <Shield className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" aria-label={`${stats.totalRules} total rules`}>
                  {stats.totalRules}
                </div>
                <p className="text-xs text-muted-foreground">
                  {stats.activeRules} active
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Blocked Today</CardTitle>
                <AlertTriangle className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" aria-label={`${stats.blockedToday.toLocaleString()} requests blocked today`}>
                  {stats.blockedToday.toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground">
                  {stats.totalBlocked.toLocaleString()} total
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Top Blocked Endpoint</CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" aria-label={`Most blocked endpoint: ${stats.topBlockedEndpoints[0]?.endpoint || 'None'}`}>
                  {stats.topBlockedEndpoints[0]?.endpoint.split('/').pop() || 'N/A'}
                </div>
                <p className="text-xs text-muted-foreground">
                  {stats.topBlockedEndpoints[0]?.blocked || 0} blocks
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Rate Limit Hits</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" aria-label={`${stats.rateLimitHits.length} rate limit hits in the last hour`}>
                  {stats.rateLimitHits.length}
                </div>
                <p className="text-xs text-muted-foreground">
                  in last hour
                </p>
              </CardContent>
            </Card>
          </div>
        </section>
      )}

      <Tabs defaultValue="rules" className="space-y-4">
        <TabsList>
          <TabsTrigger value="rules">
            <Shield className="h-4 w-4 mr-2" />
            Rate Limit Rules
          </TabsTrigger>
          <TabsTrigger value="monitoring">
            <BarChart3 className="h-4 w-4 mr-2" />
            Real-time Monitoring
          </TabsTrigger>
        </TabsList>

        <TabsContent value="rules" className="space-y-4">
          {/* Filters */}
          <section aria-labelledby="filters-heading">
            <h3 id="filters-heading" className="sr-only">Filter Rate Limit Rules</h3>
            <div className="flex items-center gap-4">
              <div className="relative flex-1 max-w-sm">
                <Label htmlFor="search-rules" className="sr-only">
                  Search rate limit rules
                </Label>
                <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <Input
                  id="search-rules"
                  ref={searchInputRef}
                  placeholder="Search rules..."
                  value={searchTerm}
                  onChange={((e: any): any) => setSearchTerm(e.target.value)}
                  className="pl-10"
                  aria-describedby="search-help"
                />
                <div id="search-help" className="sr-only">
                  Search by rule name or endpoint pattern
                </div>
              </div>
              
              <div>
                <Label htmlFor="filter-role" className="sr-only">
                  Filter by user role
                </Label>
                <select
                  id="filter-role"
                  value={filterRole}
                  onChange={((e: any): any) => setFilterRole(e.target.value)}
                  className="px-3 py-2 border rounded-md text-sm"
                  aria-label="Filter rules by user role"
                >
                  {USER_ROLES.map((role: any) => (
                    <option key={role.value} value={role.value}>{role.label}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <Label htmlFor="filter-status" className="sr-only">
                  Filter by rule status
                </Label>
                <select
                  id="filter-status"
                  value={filterStatus}
                  onChange={((e: any): any) => setFilterStatus(e.target.value as any)}
                  className="px-3 py-2 border rounded-md text-sm"
                  aria-label="Filter rules by active status"
                >
                  <option value="all">All Status</option>
                  <option value="active">Active Only</option>
                  <option value="inactive">Inactive Only</option>
                </select>
              </div>
            </div>
          </section>

          {/* Rules List */}
          <section aria-labelledby="rules-list-heading">
            <h3 id="rules-list-heading" className="sr-only">
              Rate Limit Rules ({filteredRules.length} {filteredRules.length === 1 ? 'rule' : 'rules'})
            </h3>
            <div className="space-y-4" role="list">
              {filteredRules.length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center">
                    <p className="text-muted-foreground">No rate limit rules found matching your filters.</p>
                  </CardContent>
                </Card>
              ) : (
                filteredRules.map((rule: any) => (
                  <Card key={rule.id} role="listitem">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div>
                            <h4 className="font-medium text-lg">{rule.name}</h4>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="outline" aria-label={`HTTP method: ${rule.method}`}>
                                {rule.method}
                              </Badge>
                              <span className="text-sm text-muted-foreground" aria-label={`Endpoint: ${rule.endpoint}`}>
                                {rule.endpoint}
                              </span>
                              <Badge 
                                className={rule.userRole === 'all' ? 'bg-gray-100 text-gray-800' : 'bg-blue-100 text-blue-800'}
                                aria-label={`User role: ${USER_ROLES.find((r: any) => r.value === rule.userRole)?.label}`}
                              >
                                {USER_ROLES.find((r: any) => r.value === rule.userRole)?.label}
                              </Badge>
                            </div>
                            {rule.description && (
                              <p className="text-sm text-muted-foreground mt-1">{rule.description}</p>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-4">
                          <Badge 
                            variant={rule.isActive ? "default" : "secondary"}
                            aria-label={`Rule status: ${rule.isActive ? 'Active' : 'Inactive'}`}
                          >
                            <span aria-hidden="true">{rule.isActive ? '●' : '○'}</span>
                            {rule.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                          <div className="flex items-center gap-1" role="group" aria-label={`Actions for ${rule.name}`}>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={((: any): any) => setSelectedRule(rule)}
                              aria-label={`Edit rule ${rule.name}`}
                            >
                              <Edit className="h-4 w-4" aria-hidden="true" />
                              <span className="sr-only">Edit</span>
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={((: any): any) => toggleRuleStatus(rule.id, !rule.isActive)}
                              aria-label={`${rule.isActive ? 'Deactivate' : 'Activate'} rule ${rule.name}`}
                            >
                              {rule.isActive ? (
                                <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                              ) : (
                                <CheckCircle className="h-4 w-4" aria-hidden="true" />
                              )}
                              <span className="sr-only">
                                {rule.isActive ? 'Deactivate' : 'Activate'}
                              </span>
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={((: any): any) => deleteRule(rule.id)}
                              aria-label={`Delete rule ${rule.name}`}
                            >
                              <Trash2 className="h-4 w-4" aria-hidden="true" />
                              <span className="sr-only">Delete</span>
                            </Button>
                          </div>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t" role="group" aria-label="Rate limit thresholds">
                        <div>
                          <p className="text-sm text-muted-foreground">Per Minute</p>
                          <p className="font-medium" aria-label={`${rule.requestsPerMinute} requests per minute`}>
                            {rule.requestsPerMinute} requests
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Per Hour</p>
                          <p className="font-medium" aria-label={`${rule.requestsPerHour} requests per hour`}>
                            {rule.requestsPerHour} requests
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Per Day</p>
                          <p className="font-medium" aria-label={`${rule.requestsPerDay} requests per day`}>
                            {rule.requestsPerDay} requests
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </section>
        </TabsContent>      
  <TabsContent value="monitoring" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Recent Rate Limit Hits</CardTitle>
                <CardDescription>Real-time monitoring of rate limit violations</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {stats?.rateLimitHits.slice(0, 10).map((hit, index: any) => (
                    <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">{hit.endpoint}</p>
                        <p className="text-sm text-muted-foreground">
                          {USER_ROLES.find((r: any) => r.value === hit.userRole)?.label} • {hit.hits} hits
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">
                          {new Date(hit.timestamp).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  )) || (
                    <p className="text-center text-muted-foreground py-8">
                      No recent rate limit hits
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Top Blocked Endpoints</CardTitle>
                <CardDescription>Endpoints with most rate limit violations</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {stats?.topBlockedEndpoints.map((endpoint, index: any) => (
                    <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">{endpoint.endpoint}</p>
                        <p className="text-sm text-muted-foreground">#{index + 1} most blocked</p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">{endpoint.blocked.toLocaleString()}</p>
                        <p className="text-sm text-muted-foreground">blocks</p>
                      </div>
                    </div>
                  )) || (
                    <p className="text-center text-muted-foreground py-8">
                      No blocked endpoints data
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Rule Edit/Create Modal */}
      {(selectedRule || showCreateForm) && (
        <RateLimitRuleModal
          rule={selectedRule}
          onSave={saveRule}
          onClose={() => {
            setSelectedRule(null)
            setShowCreateForm(false)
          }}
          saving={saving}
        />
      )}
    </div>
  )
}

// Rate Limit Rule Modal Component
interface RateLimitRuleModalProps {
  rule: RateLimitRule | null
  onSave: (rule: Partial<RateLimitRule>) => void
  onClose: () => void
  saving: boolean
}

function RateLimitRuleModal({ rule, onSave, onClose, saving }: RateLimitRuleModalProps) {
  const [formData, setFormData] = useState<Partial<RateLimitRule>>(
    rule || {
      name: '',
      endpoint: '',
      method: 'ALL',
      userRole: 'all',
      requestsPerMinute: 60,
      requestsPerHour: 1000,
      requestsPerDay: 10000,
      priority: 1,
      description: ''
    }
  )

  const modalTitleId = `modal-title-${rule?.id || 'new'}`
  const modalDescId = `modal-desc-${rule?.id || 'new'}`

  // Focus management
  const firstFocusableRef = useRef<HTMLInputElement>(null)
  const lastFocusableRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    // Focus the first input when modal opens
    if (firstFocusableRef.current) {
      firstFocusableRef.current.focus()
    }

    // Handle escape key
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    // Trap focus within modal
    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        const focusableElements = document.querySelectorAll(
          'input:not([disabled]), select:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
        const firstElement = focusableElements[0] as HTMLElement
        const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement

        if (e.shiftKey && document.activeElement === firstElement) {
          e.preventDefault()
          lastElement.focus()
        } else if (!e.shiftKey && document.activeElement === lastElement) {
          e.preventDefault()
          firstElement.focus()
        }
      }
    }

    document.addEventListener('keydown', handleEscape)
    document.addEventListener('keydown', handleTabKey)

    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.removeEventListener('keydown', handleTabKey)
    }
  }, [onClose])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave(formData)
  }

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      role="dialog"
      aria-modal="true"
      aria-labelledby={modalTitleId}
      aria-describedby={modalDescId}
    >
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 id={modalTitleId} className="text-xl font-bold">
            {rule ? 'Edit Rate Limit Rule' : 'Create New Rate Limit Rule'}
          </h2>
          <Button 
            variant="ghost" 
            onClick={onClose}
            aria-label="Close dialog"
            ref={lastFocusableRef}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>

        <p id={modalDescId} className="text-sm text-muted-foreground mb-4">
          {rule ? 'Modify the settings for this rate limit rule.' : 'Configure a new rate limit rule for API endpoints.'}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="name">Rule Name *</Label>
            <Input
              id="name"
              ref={firstFocusableRef}
              value={formData.name || ''}
              onChange={((e: any): any) => setFormData({ ...formData, name: e.target.value })}
              required
              aria-describedby="name-help"
            />
            <div id="name-help" className="text-xs text-muted-foreground mt-1">
              A descriptive name for this rate limit rule
            </div>
          </div>

          <fieldset className="grid grid-cols-2 gap-4 border rounded-lg p-4">
            <legend className="text-sm font-medium px-2">Endpoint Configuration</legend>
            <div>
              <Label htmlFor="endpoint">Endpoint Pattern *</Label>
              <Input
                id="endpoint"
                value={formData.endpoint || ''}
                onChange={((e: any): any) => setFormData({ ...formData, endpoint: e.target.value })}
                placeholder="/api/v1/*"
                required
                aria-describedby="endpoint-help"
              />
              <div id="endpoint-help" className="text-xs text-muted-foreground mt-1">
                Use * for wildcards (e.g., /api/v1/*)
              </div>
            </div>
            <div>
              <Label htmlFor="method">HTTP Method *</Label>
              <select
                id="method"
                value={formData.method || 'ALL'}
                onChange={((e: any): any) => setFormData({ ...formData, method: e.target.value })}
                className="w-full px-3 py-2 border rounded-md"
                required
                aria-describedby="method-help"
              >
                {HTTP_METHODS.map((method: any) => (
                  <option key={method.value} value={method.value}>{method.label}</option>
                ))}
              </select>
              <div id="method-help" className="text-xs text-muted-foreground mt-1">
                HTTP method to apply this rule to
              </div>
            </div>
          </fieldset>

          <div>
            <Label htmlFor="userRole">User Role *</Label>
            <select
              id="userRole"
              value={formData.userRole || 'all'}
              onChange={((e: any): any) => setFormData({ ...formData, userRole: e.target.value })}
              className="w-full px-3 py-2 border rounded-md"
              required
              aria-describedby="role-help"
            >
              {USER_ROLES.map((role: any) => (
                <option key={role.value} value={role.value}>{role.label}</option>
              ))}
            </select>
            <div id="role-help" className="text-xs text-muted-foreground mt-1">
              Which user roles this rate limit applies to
            </div>
          </div>

          <fieldset className="grid grid-cols-3 gap-4 border rounded-lg p-4">
            <legend className="text-sm font-medium px-2">Rate Limits</legend>
            <div>
              <Label htmlFor="requestsPerMinute">Per Minute *</Label>
              <Input
                id="requestsPerMinute"
                type="number"
                min="1"
                max="10000"
                value={formData.requestsPerMinute || 60}
                onChange={((e: any): any) => setFormData({ ...formData, requestsPerMinute: parseInt(e.target.value) || 60 })}
                required
                aria-describedby="minute-help"
              />
              <div id="minute-help" className="text-xs text-muted-foreground mt-1">
                Max requests per minute
              </div>
            </div>
            <div>
              <Label htmlFor="requestsPerHour">Per Hour *</Label>
              <Input
                id="requestsPerHour"
                type="number"
                min="1"
                max="100000"
                value={formData.requestsPerHour || 1000}
                onChange={((e: any): any) => setFormData({ ...formData, requestsPerHour: parseInt(e.target.value) || 1000 })}
                required
                aria-describedby="hour-help"
              />
              <div id="hour-help" className="text-xs text-muted-foreground mt-1">
                Max requests per hour
              </div>
            </div>
            <div>
              <Label htmlFor="requestsPerDay">Per Day *</Label>
              <Input
                id="requestsPerDay"
                type="number"
                min="1"
                max="1000000"
                value={formData.requestsPerDay || 10000}
                onChange={((e: any): any) => setFormData({ ...formData, requestsPerDay: parseInt(e.target.value) || 10000 })}
                required
                aria-describedby="day-help"
              />
              <div id="day-help" className="text-xs text-muted-foreground mt-1">
                Max requests per day
              </div>
            </div>
          </fieldset>

          <div>
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              value={formData.description || ''}
              onChange={((e: any): any) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Describe this rate limit rule..."
              aria-describedby="desc-help"
            />
            <div id="desc-help" className="text-xs text-muted-foreground mt-1">
              Optional description for this rule
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isActive"
                checked={formData.isActive || false}
                onChange={((e: any): any) => setFormData({ ...formData, isActive: e.target.checked })}
                className="rounded border-gray-300 focus:ring-2 focus:ring-blue-500"
                aria-describedby="active-help"
              />
              <Label htmlFor="isActive">Rule is active</Label>
            </div>
            <div id="active-help" className="text-xs text-muted-foreground">
              Inactive rules are not enforced
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving} aria-describedby="save-status">
              {saving ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />
                  Saving...
                </>
              ) : (
                'Save Rule'
              )}
            </Button>
            {saving && (
              <div id="save-status" className="sr-only" aria-live="polite">
                Saving rate limit rule, please wait...
              </div>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}