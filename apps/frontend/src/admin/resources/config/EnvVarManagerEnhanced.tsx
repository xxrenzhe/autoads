'use client'

import React, { useState, useEffect } from 'react'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/Card'
import { Button } from '@/shared/components/ui/Button'
import { Input } from '@/shared/components/ui/Input'
import { Badge } from '@/shared/components/ui/badge'
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
import { Label } from '@/shared/components/ui/label'
import { Switch } from '@/shared/components/ui/Switch'
import {
  AlertCircle,
  CheckCircle,
  Clock,
  Plus,
  Edit,
  Trash2,
  RefreshCw,
  Shield,
  Eye,
  EyeOff,
} from 'lucide-react'
import { toast } from 'sonner'

interface EnvironmentVariable {
  id: string
  key: string
  value: string
  isSecret: boolean
  createdAt: string
  updatedAt: string
  createdBy: string
  creator?: {
    name: string
    email: string
  }
}

interface EnvVarManagerProps {
  initialVars?: EnvironmentVariable[]
}

export default function EnvVarManager({ initialVars = [] }: EnvVarManagerProps) {
  const [envVars, setEnvVars] = useState<EnvironmentVariable[]>(initialVars)
  const [loading, setLoading] = useState(false)
  const [reloadStatus, setReloadStatus] = useState<{ [key: string]: 'pending' | 'success' | 'error' }>({})
  const [showSecrets, setShowSecrets] = useState<{ [key: string]: boolean }>({})
  const [editingVar, setEditingVar] = useState<EnvironmentVariable | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [formData, setFormData] = useState({
    key: '',
    value: '',
    isSecret: false,
    isHotReload: false,
  })

  useEffect(() => {
    fetchEnvVars()
  }, [])

  const fetchEnvVars = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/admin/env-vars')
      if (response.ok) {
        const data = await response.json()
        setEnvVars(data)
      }
    } catch (error) {
      toast.error('Failed to fetch environment variables')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!formData.key || !formData.value) {
      toast.error('Key and value are required')
      return
    }

    try {
      const response = await fetch('/api/admin/env-vars', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: editingVar?.id,
          key: formData.key,
          value: formData.value,
          isSecret: formData.isSecret,
          isHotReload: formData.isHotReload,
        }),
      })

      if (response.ok) {
        toast.success(
          editingVar ? 'Environment variable updated' : 'Environment variable created'
        )
        setDialogOpen(false)
        setEditingVar(null)
        setFormData({
          key: '',
          value: '',
          isSecret: false,
          isHotReload: false,
        })
        fetchEnvVars()

        // Show reload status if hot reload enabled
        if (formData.isHotReload) {
          setReloadStatus(prev => ({
            ...prev,
            [formData.key]: 'pending',
          }))
          
          // Simulate reload completion
          setTimeout(() => {
            setReloadStatus(prev => ({
              ...prev,
              [formData.key]: 'success',
            }))
            setTimeout(() => {
              setReloadStatus(prev => {
                const newStatus = { ...prev }
                delete newStatus[formData.key]
                return newStatus
              })
            }, 3000)
          }, 1000)
        }
      } else {
        toast.error('Failed to save environment variable')
      }
    } catch (error) {
      toast.error('Failed to save environment variable')
    }
  }

  const handleDelete = async (id: string, key: string) => {
    if (!confirm(`Are you sure you want to delete ${key}?`)) {
      return
    }

    try {
      const response = await fetch(`/api/admin/env-vars/${id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        toast.success('Environment variable deleted')
        fetchEnvVars()
        
        // Show reload status
        setReloadStatus(prev => ({
          ...prev,
          [key]: 'pending',
        }))
        
        setTimeout(() => {
          setReloadStatus(prev => ({
            ...prev,
            [key]: 'success',
          }))
          setTimeout(() => {
            setReloadStatus(prev => {
              const newStatus = { ...prev }
              delete newStatus[key]
              return newStatus
            })
          }, 3000)
        }, 1000)
      } else {
        toast.error('Failed to delete environment variable')
      }
    } catch (error) {
      toast.error('Failed to delete environment variable')
    }
  }

  const handleEdit = (envVar: EnvironmentVariable) => {
    setEditingVar(envVar)
    setFormData({
      key: envVar.key,
      value: envVar.isSecret ? '' : envVar.value,
      isSecret: envVar.isSecret,
      isHotReload: false,
    })
    setDialogOpen(true)
  }

  const toggleSecretVisibility = (key: string) => {
    setShowSecrets(prev => ({
      ...prev,
      [key]: !prev[key],
    }))
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500" />
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />
      default:
        return null
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center">
              <Shield className="h-5 w-5 mr-2" />
              Environment Variables
            </CardTitle>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={fetchEnvVars}
                disabled={loading}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={() => setEditingVar(null)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Variable
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                  <DialogHeader>
                    <DialogTitle>
                      {editingVar ? 'Edit Environment Variable' : 'Add Environment Variable'}
                    </DialogTitle>
                    <DialogDescription>
                      {editingVar
                        ? 'Update the environment variable configuration.'
                        : 'Add a new environment variable to the system.'}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="key" className="text-right">
                        Key *
                      </Label>
                      <Input
                        id="key"
                        value={formData.key}
                        onChange={(e) => setFormData({ ...formData, key: e.target.value.toUpperCase() })}
                        className="col-span-3"
                        disabled={!!editingVar}
                        placeholder="e.g., API_URL"
                      />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="value" className="text-right">
                        Value *
                      </Label>
                      <Input
                        id="value"
                        type={formData.isSecret ? 'password' : 'text'}
                        value={formData.value}
                        onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                        className="col-span-3"
                        placeholder="Enter value"
                      />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="isSecret" className="text-right">
                        Secret
                      </Label>
                      <div className="col-span-3 flex items-center space-x-2">
                        <Switch
                          id="isSecret"
                          checked={formData.isSecret}
                          onCheckedChange={(checked: boolean) => setFormData({ ...formData, isSecret: checked })}
                        />
                        <Label className="text-sm text-muted-foreground">
                          Encrypt this value
                        </Label>
                      </div>
                    </div>
                    {!editingVar && (
                      <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="isHotReload" className="text-right">
                          Hot Reload
                        </Label>
                        <div className="col-span-3 flex items-center space-x-2">
                          <Switch
                            id="isHotReload"
                            checked={formData.isHotReload}
                            onCheckedChange={(checked: boolean) => setFormData({ ...formData, isHotReload: checked })}
                          />
                          <Label className="text-sm text-muted-foreground">
                            Apply changes without restart
                          </Label>
                        </div>
                      </div>
                    )}
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleSave}>
                      {editingVar ? 'Update' : 'Create'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Key</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Last Updated</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {envVars.map((envVar) => (
                  <TableRow key={envVar.id}>
                    <TableCell className="font-medium">{envVar.key}</TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <code className="text-sm bg-muted px-2 py-1 rounded">
                          {showSecrets[envVar.key] || !envVar.isSecret
                            ? envVar.value
                            : '••••••••'}
                        </code>
                        {envVar.isSecret && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleSecretVisibility(envVar.key)}
                        >
                            {showSecrets[envVar.key] ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={envVar.isSecret ? 'destructive' : 'secondary'}>
                        {envVar.isSecret ? 'Secret' : 'Public'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(envVar.updatedAt).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      {reloadStatus[envVar.key] && (
                        <div className="flex items-center space-x-1">
                          {getStatusIcon(reloadStatus[envVar.key])}
                          <span className="text-xs text-muted-foreground">
                            {reloadStatus[envVar.key] === 'pending' && 'Reloading...'}
                            {reloadStatus[envVar.key] === 'success' && 'Reloaded'}
                            {reloadStatus[envVar.key] === 'error' && 'Failed'}
                          </span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(envVar)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(envVar.id, envVar.key)}
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
