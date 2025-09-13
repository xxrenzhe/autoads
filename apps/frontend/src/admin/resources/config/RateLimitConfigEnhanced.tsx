'use client'

import React, { useState, useEffect } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/Card'
import { Button } from '@/shared/components/ui/Button'
import { Input } from '@/shared/components/ui/Input'
import { Label } from '@/shared/components/ui/label'
import { Switch } from '@/shared/components/ui/Switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/Select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/shared/components/ui/Dialog'
import { Badge } from '../../components/ui/badge'
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '../../components/ui/alert'
import {
  Plus,
  Edit,
  Trash2,
  RefreshCw,
  Activity,
  Pause,
  AlertTriangle,
  CheckCircle,
} from 'lucide-react'
import { toast } from 'sonner'

interface RateLimitRule {
  id: string
  endpoint: string
  method: string
  userRole: string
  maxRequests: number
  windowMs: number
  enabled: boolean
  createdAt: string
  updatedAt: string
}

interface RateLimitConfigProps {
  initialRules?: RateLimitRule[]
}

export default function RateLimitConfig({ initialRules = [] }: RateLimitConfigProps) {
  const [rules, setRules] = useState<RateLimitRule[]>(initialRules)
  const [loading, setLoading] = useState(false)
  const [editingRule, setEditingRule] = useState<RateLimitRule | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [reloadStatus, setReloadStatus] = useState<{ [key: string]: 'pending' | 'success' | 'error' }>({})
  const [formData, setFormData] = useState({
    endpoint: '',
    method: 'ALL',
    userRole: 'all',
    requestsPerMinute: 60,
    status: 'ACTIVE',
  })

  useEffect(() => {
    fetchRules()
  }, [])

  const fetchRules = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/api-management/rate-limits')
      if (response.ok) {
        const data = await response.json()
        setRules(data.data || [])
      }
    } catch (error) {
      toast.error('Failed to fetch rate limit rules')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!formData.endpoint) {
      toast.error('Endpoint is required')
      return
    }

    try {
      const response = await fetch('/api/admin/api-management/rate-limits', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          requestsPerHour: formData.requestsPerMinute * 60,
          requestsPerDay: formData.requestsPerMinute * 1440,
        }),
      })

      if (response.ok) {
        toast.success('Rate limit rule saved')
        setDialogOpen(false)
        setEditingRule(null)
        setFormData({
          endpoint: '',
          method: 'ALL',
          userRole: 'all',
          requestsPerMinute: 60,
          status: 'ACTIVE',
        })
        fetchRules()

        // Show reload status
        const ruleKey = `${formData.method}:${formData.endpoint}:${formData.userRole}`
        setReloadStatus(prev => ({
          ...prev,
          [ruleKey]: 'pending',
        }))
        
        setTimeout(() => {
          setReloadStatus(prev => ({
            ...prev,
            [ruleKey]: 'success',
          }))
          setTimeout(() => {
            setReloadStatus(prev => {
              const newStatus = { ...prev }
              delete newStatus[ruleKey]
              return newStatus
            })
          }, 3000)
        }, 1000)
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to save rate limit rule')
      }
    } catch (error) {
      toast.error('Failed to save rate limit rule')
    }
  }

  const handleDelete = async (id: string, rule: RateLimitRule) => {
    if (!confirm(`Are you sure you want to delete this rate limit rule?`)) {
      return
    }

    try {
      const response = await fetch(`/api/admin/api-management/rate-limits/${id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        toast.success('Rate limit rule deleted')
        fetchRules()
        
        // Show reload status
        const ruleKey = `${rule.method}:${rule.endpoint}:${rule.userRole}`
        setReloadStatus(prev => ({
          ...prev,
          [ruleKey]: 'pending',
        }))
        
        setTimeout(() => {
          setReloadStatus(prev => ({
            ...prev,
            [ruleKey]: 'success',
          }))
          setTimeout(() => {
            setReloadStatus(prev => {
              const newStatus = { ...prev }
              delete newStatus[ruleKey]
              return newStatus
            })
          }, 3000)
        }, 1000)
      } else {
        toast.error('Failed to delete rate limit rule')
      }
    } catch (error) {
      toast.error('Failed to delete rate limit rule')
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <RefreshCw className="h-4 w-4 animate-spin text-yellow-500" />
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'error':
        return <AlertTriangle className="h-4 w-4 text-red-500" />
      default:
        return null
    }
  }

  const formatWindow = (windowMs: number) => {
    if (windowMs < 1000) return `${windowMs}ms`
    if (windowMs < 60000) return `${windowMs / 1000}s`
    if (windowMs < 3600000) return `${windowMs / 60000}min`
    return `${windowMs / 3600000}h`
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center">
                <Activity className="h-5 w-5 mr-2" />
                Rate Limit Configuration
              </CardTitle>
              <CardDescription>
                Configure rate limiting rules for API endpoints
              </CardDescription>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={fetchRules}
                disabled={loading}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Rule
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[500px]">
                  <DialogHeader>
                    <DialogTitle>
                      {editingRule ? 'Edit Rate Limit Rule' : 'Add Rate Limit Rule'}
                    </DialogTitle>
                    <DialogDescription>
                      Configure rate limiting for API endpoints
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="endpoint" className="text-right">
                        Endpoint *
                      </Label>
                      <Input
                        id="endpoint"
                        value={formData.endpoint}
                        onChange={(e) => setFormData({ ...formData, endpoint: e.target.value })}
                        className="col-span-3"
                        placeholder="/api/*"
                      />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="method" className="text-right">
                        Method
                      </Label>
                      <Select
                        value={formData.method}
                        onValueChange={(value) => setFormData({ ...formData, method: value })}
                      >
                        <SelectTrigger className="col-span-3">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ALL">ALL</SelectItem>
                          <SelectItem value="GET">GET</SelectItem>
                          <SelectItem value="POST">POST</SelectItem>
                          <SelectItem value="PUT">PUT</SelectItem>
                          <SelectItem value="DELETE">DELETE</SelectItem>
                          <SelectItem value="PATCH">PATCH</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="userRole" className="text-right">
                        User Role
                      </Label>
                      <Select
                        value={formData.userRole}
                        onValueChange={(value) => setFormData({ ...formData, userRole: value })}
                      >
                        <SelectTrigger className="col-span-3">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Users</SelectItem>
                          <SelectItem value="USER">User</SelectItem>
                          <SelectItem value="ADMIN">Admin</SelectItem>
                          <SelectItem value="SUPER_ADMIN">Super Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="requests" className="text-right">
                        Requests/Min
                      </Label>
                      <Input
                        id="requests"
                        type="number"
                        min="1"
                        value={formData.requestsPerMinute}
                        onChange={(e) => setFormData({ ...formData, requestsPerMinute: parseInt(e.target.value) })}
                        className="col-span-3"
                      />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="isActive" className="text-right">
                        Active
                      </Label>
                      <div className="col-span-3 flex items-center space-x-2">
                        <Switch
                          id="isActive"
                          checked={formData.status === 'ACTIVE'}
                          onCheckedChange={(checked: boolean) => setFormData({ ...formData, status: checked ? 'ACTIVE' : 'INACTIVE' })}
                        />
                        <Label className="text-sm text-muted-foreground">
                          Enable this rule
                        </Label>
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleSave}>
                      {editingRule ? 'Update' : 'Create'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Alert className="mb-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Hot Reload Enabled</AlertTitle>
            <AlertDescription>
              Changes to rate limit rules are applied immediately without restarting the server.
            </AlertDescription>
          </Alert>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Endpoint</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Limit</TableHead>
                  <TableHead>Window</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Reload Status</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rules.map((rule) => (
                  <TableRow key={rule.id}>
                    <TableCell className="font-medium">{rule.endpoint}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{rule.method}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{rule.userRole}</Badge>
                    </TableCell>
                    <TableCell>{rule.maxRequests} requests</TableCell>
                    <TableCell>{formatWindow(rule.windowMs)}</TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        {rule.enabled ? (
                          <>
                            <Activity className="h-4 w-4 text-green-500" />
                            <span className="text-sm">Active</span>
                          </>
                        ) : (
                          <>
                            <Pause className="h-4 w-4 text-gray-500" />
                            <span className="text-sm">Paused</span>
                          </>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {reloadStatus[`${rule.method}:${rule.endpoint}:${rule.userRole}`] && (
                        <div className="flex items-center space-x-1">
                          {getStatusIcon(reloadStatus[`${rule.method}:${rule.endpoint}:${rule.userRole}`])}
                          <span className="text-xs text-muted-foreground">
                            {reloadStatus[`${rule.method}:${rule.endpoint}:${rule.userRole}`] === 'pending' && 'Reloading...'}
                            {reloadStatus[`${rule.method}:${rule.endpoint}:${rule.userRole}`] === 'success' && 'Reloaded'}
                            {reloadStatus[`${rule.method}:${rule.endpoint}:${rule.userRole}`] === 'error' && 'Failed'}
                          </span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditingRule(rule)
                            setFormData({
                              endpoint: rule.endpoint,
                              method: rule.method,
                              userRole: rule.userRole,
                              requestsPerMinute: Math.floor(rule.maxRequests / (rule.windowMs / 60000)),
                              status: rule.enabled ? 'ACTIVE' : 'INACTIVE',
                            })
                            setDialogOpen(true)
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(rule.id, rule)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}