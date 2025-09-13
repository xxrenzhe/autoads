'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/Card'
import { Button } from '@/shared/components/ui/Button'
import { Input } from '@/shared/components/ui/Input'
import { Label } from '../../components/ui/label'
import { Textarea } from '../../components/ui/textarea'
import { Badge } from '../../components/ui/badge'
import { Alert, AlertDescription } from '../../components/ui/alert'
import { 
  Save,
  X,
  Shield,
  Info,
  Key,
  CheckCircle,
  AlertTriangle
} from 'lucide-react'
import { useCreateEnvVar, useUpdateEnvVar, getEnvVarCategory } from '../../hooks/useEnvVarManagement'
import { EnvironmentVariable } from '../../hooks/useEnvVarManagement'

interface EnvVarEditProps {
  envVar?: EnvironmentVariable
  onSave?: (envVar: EnvironmentVariable) => void
  onCancel?: () => void
}

export function EnvVarEdit({ envVar, onSave, onCancel }: EnvVarEditProps) {
  const isEdit = !!envVar
  
  const [formData, setFormData] = useState({
    key: '',
    value: '',
    isSecret: false,
  })
  
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  
  const createEnvVar = useCreateEnvVar()
  const updateEnvVar = useUpdateEnvVar()
  
  useEffect(() => {
    if (envVar) {
      setFormData({
        key: envVar.key,
        value: envVar.value,
        isSecret: envVar.isSecret,
      })
    }
  }, [envVar])
  
  const validateForm = () => {
    const newErrors: Record<string, string> = {}
    
    if (!formData.key.trim()) {
      newErrors.key = 'Key is required'
    } else if (!/^[A-Z_][A-Z0-9_]*$/.test(formData.key)) {
      newErrors.key = 'Key must be uppercase letters, numbers, and underscores only'
    }
    
    if (!formData.value.trim()) {
      newErrors.value = 'Value is required'
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }
  
  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
    
    if (touched[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: ''
      }))
    }
  }
  
  const handleBlur = (field: string) => {
    setTouched(prev => ({
      ...prev,
      [field]: true
    }))
    
    if (errors[field]) {
      validateForm()
    }
  }
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) {
      return
    }
    
    try {
      if (isEdit && envVar) {
        await updateEnvVar.mutateAsync({
          id: envVar.id,
          data: formData
        })
      } else {
        await createEnvVar.mutateAsync({
          ...formData,
          createdBy: 'current-user'
        })
      }
      
      onSave?.(envVar ? { ...envVar, ...formData } as EnvironmentVariable : 
        { ...formData, id: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), createdBy: 'current-user' } as EnvironmentVariable)
    } catch (error) {
      console.error('Failed to save environment variable:', error)
    }
  }
  
  const isSubmitting = createEnvVar.isPending || updateEnvVar.isPending
  const category = formData.key ? getEnvVarCategory(formData.key) : 'Other'
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Key className="h-5 w-5" />
          {isEdit ? 'Edit Environment Variable' : 'Create Environment Variable'}
        </CardTitle>
      </CardHeader>
      
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Key Field */}
          <div>
            <Label htmlFor="key" className="flex items-center gap-2">
              Variable Key
              <Badge variant="outline" className="text-xs">
                {category}
              </Badge>
            </Label>
            <Input
              id="key"
              value={formData.key}
              onChange={((e: any): any) => handleInputChange('key', e.target.value.toUpperCase())}
              onBlur={() => handleBlur('key')}
              placeholder="e.g., DATABASE_URL"
              disabled={isSubmitting || isEdit}
              className={`mt-1 ${errors.key ? 'border-red-500' : ''}`}
            />
            {errors.key && (
              <p className="text-red-500 text-sm mt-1">{errors.key}</p>
            )}
            <p className="text-xs text-gray-500 mt-1">
              Use uppercase letters, numbers, and underscores only
            </p>
          </div>
          
          {/* Value Field */}
          <div>
            <Label htmlFor="value" className="flex items-center gap-2">
              Value
              {formData.isSecret && (
                <Shield className="h-4 w-4 text-orange-500" />
              )}
            </Label>
            <Textarea
              id="value"
              value={formData.value}
              onChange={((e: React.ChangeEvent<HTMLTextAreaElement>: any): any) => handleInputChange('value', e.target.value)}
              onBlur={() => handleBlur('value')}
              placeholder="Enter the variable value"
              disabled={isSubmitting}
              rows={3}
              className={`mt-1 ${errors.value ? 'border-red-500' : ''}`}
            />
            {errors.value && (
              <p className="text-red-500 text-sm mt-1">{errors.value}</p>
            )}
          </div>
          
          {/* Secret Checkbox */}
          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.isSecret}
                onChange={((e: any): any) => handleInputChange('isSecret', e.target.checked)}
                disabled={isSubmitting}
                className="rounded border-gray-300"
              />
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                <span>This is a secret value</span>
              </div>
            </label>
            <p className="text-xs text-gray-500 mt-1 ml-6">
              Secret values will be hidden from non-super administrators
            </p>
          </div>
          
          {/* Warning for sensitive variables */}
          {formData.isSecret && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                This variable contains sensitive information. It will be encrypted and masked in the UI for regular administrators.
              </AlertDescription>
            </Alert>
          )}
          
          {/* Info about hot reload */}
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Changes to environment variables will take effect immediately. Users will be notified to refresh their pages.
            </AlertDescription>
          </Alert>
          
          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={isSubmitting}
            >
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            
            <Button
              type="submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  {isEdit ? 'Update' : 'Create'}
                </>
              )}
            </Button>
          </div>
          
          {/* Success message */}
          {(createEnvVar.isSuccess || updateEnvVar.isSuccess) && (
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-700">
                Environment variable {isEdit ? 'updated' : 'created'} successfully!
              </AlertDescription>
            </Alert>
          )}
        </form>
      </CardContent>
    </Card>
  )
}