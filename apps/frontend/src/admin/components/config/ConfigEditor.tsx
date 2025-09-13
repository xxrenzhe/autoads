'use client'
import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/Card'
import { Button } from '@/shared/components/ui/Button'
import { Input } from '@/shared/components/ui/Input'
import { Badge } from '../ui/badge'
import { 
  Settings, 
  Save, 
  X,
  Eye,
  EyeOff,
  Code,
  AlertTriangle,
  Check,
  Info,
  Shield,
  RefreshCw
} from 'lucide-react'
import { ConfigItem } from './ConfigList'
import { useConfigManagement } from '../../hooks/useConfigManagement'

export interface ConfigEditorProps {
  config?: ConfigItem | null
  onSave?: (configData: Partial<ConfigItem>) => Promise<void>
  onCancel?: () => void
  isLoading?: boolean
  error?: string | null
}

export interface ConfigFormData {
  key: string
  value: any
  type: 'string' | 'number' | 'boolean' | 'json' | 'array'
  category: string
  description: string
  isSecret: boolean
  isRequired: boolean
  defaultValue?: any
  validation?: {
    min?: number
    max?: number
    pattern?: string
    enum?: string[]
  }
  environment: 'all' | 'development' | 'staging' | 'production'
}

export function ConfigEditor({
  config,
  onSave,
  onCancel,
  isLoading = false,
  error = null
}: ConfigEditorProps) {
  const { categories, validateConfigValue } = useConfigManagement()
  
  const [formData, setFormData] = useState<ConfigFormData>({
    key: '',
    value: '',
    type: 'string',
    category: 'system',
    description: '',
    isSecret: false,
    isRequired: false,
    environment: 'all'
  })
  
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})
  const [isDirty, setIsDirty] = useState(false)
  const [showValue, setShowValue] = useState(false)
  const [jsonError, setJsonError] = useState<string | null>(null)

  const isEditing = !!config

  // Initialize form data when config prop changes
  useEffect(() => {
    if (config) {
      setFormData({
        key: config.key,
        value: config.value,
        type: config.type,
        category: config.category,
        description: config.description,
        isSecret: config.isSecret,
        isRequired: config.isRequired,
        defaultValue: config.defaultValue,
        validation: config.validation,
        environment: config.environment
      })
      setShowValue(!config.isSecret)
    } else {
      setFormData({
        key: '',
        value: '',
        type: 'string',
        category: 'system',
        description: '',
        isSecret: false,
        isRequired: false,
        environment: 'all'
      })
      setShowValue(true)
    }
    setIsDirty(false)
    setValidationErrors({})
    setJsonError(null)
  }, [config])

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {}

    // Key validation
    if (!formData.key.trim()) {
      errors.key = 'Key is required'
    } else if (!/^[A-Z_][A-Z0-9_]*$/i.test(formData.key)) {
      errors.key = 'Key must contain only letters, numbers, and underscores'
    }

    // Value validation
    if (formData.isRequired && (formData.value === '' || formData.value == null)) {
      errors.value = 'Value is required'
    }

    // Type-specific validation
    if (formData.value !== '' && formData.value != null) {
      let parsedValue = formData.value
      
      try {
        switch (formData.type) {
          case 'number':
            parsedValue = Number(formData.value)
            if (isNaN(parsedValue)) {
              errors.value = 'Value must be a valid number'
            }
            break
          case 'boolean':
            if (typeof formData.value === 'string') {
              if (!['true', 'false'].includes(formData.value.toLowerCase())) {
                errors.value = 'Value must be true or false'
              }
              parsedValue = formData.value.toLowerCase() === 'true'
            }
            break
          case 'json':
            if (typeof formData.value === 'string') {
              try {
                parsedValue = JSON.parse(formData.value)
              } catch {
                errors.value = 'Value must be valid JSON'
              }
            }
            break
          case 'array':
            if (typeof formData.value === 'string') {
              try {
                parsedValue = JSON.parse(formData.value)
                if (!Array.isArray(parsedValue)) {
                  errors.value = 'Value must be a valid JSON array'
                }
              } catch {
                errors.value = 'Value must be a valid JSON array'
              }
            } else if (!Array.isArray(formData.value)) {
              errors.value = 'Value must be an array'
            }
            break
        }

        // Custom validation if no type errors
        if (!errors.value && config) {
          const validation = validateConfigValue({ ...config, ...formData } as ConfigItem, parsedValue)
          if (!validation.isValid) {
            errors.value = validation.error || 'Invalid value'
          }
        }
      } catch (err) {
        errors.value = 'Invalid value format'
      }
    }

    // Description validation
    if (!formData.description.trim()) {
      errors.description = 'Description is required'
    }

    // Category validation
    if (!formData.category.trim()) {
      errors.category = 'Category is required'
    }

    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleInputChange = (field: keyof ConfigFormData, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
    setIsDirty(true)

    // Clear validation error for this field
    if (validationErrors[field]) {
      setValidationErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors[field]
        return newErrors
      })
    }

    // Clear JSON error when value changes
    if (field === 'value') {
      setJsonError(null)
    }
  }

  const handleValidationChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      validation: {
        ...prev.validation,
        [field]: value === '' ? undefined : value
      }
    }))
    setIsDirty(true)
  }

  const formatValueForDisplay = () => {
    if (formData.type === 'json' || formData.type === 'array') {
      try {
        return JSON.stringify(formData.value, null, 2)
      } catch {
        return String(formData.value)
      }
    }
    return String(formData.value)
  }

  const handleValueChange = (newValue: string) => {
    let processedValue: any = newValue

    // Process value based on type
    switch (formData.type) {
      case 'number':
        processedValue = newValue === '' ? '' : Number(newValue)
        break
      case 'boolean':
        processedValue = newValue.toLowerCase() === 'true'
        break
      case 'json':
      case 'array':
        try {
          if (newValue.trim()) {
            processedValue = JSON.parse(newValue)
            setJsonError(null)
          } else {
            processedValue = formData.type === 'array' ? [] : {}
          }
        } catch (err) {
          processedValue = newValue // Keep as string for editing
          setJsonError('Invalid JSON format')
        }
        break
      default:
        processedValue = newValue
    }

    handleInputChange('value', processedValue)
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    
    if (!validateForm()) {
      return
    }

    try {
      await onSave?.(formData)
    } catch (err) {
      console.error('Error saving config:', err)
    }
  }

  const getTypeOptions = () => [
    { value: 'string', label: 'String' },
    { value: 'number', label: 'Number' },
    { value: 'boolean', label: 'Boolean' },
    { value: 'json', label: 'JSON Object' },
    { value: 'array', label: 'Array' }
  ]

  const getEnvironmentOptions = () => [
    { value: 'all', label: 'All Environments' },
    { value: 'development', label: 'Development' },
    { value: 'staging', label: 'Staging' },
    { value: 'production', label: 'Production' }
  ]

  return (
    <div className="max-w-4xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Settings className="h-5 w-5 mr-2" />
            {isEditing ? 'Edit Configuration' : 'Create New Configuration'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Error Display */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-md p-4">
                <div className="flex">
                  <AlertTriangle className="h-5 w-5 text-red-400" />
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800">
                      Error saving configuration
                    </h3>
                    <p className="mt-1 text-sm text-red-700">{error}</p>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left Column - Basic Info */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                  Basic Information
                </h3>

                {/* Key */}
                <div>
                  <label htmlFor="key" className="block text-sm font-medium text-gray-700 mb-1">
                    Configuration Key *
                  </label>
                  <Input
                    id="key"
                    type="text"
                    value={formData.key}
                    onChange={(e) => handleInputChange('key', (e.target as any).value)}
                    placeholder="e.g., DATABASE_URL, API_KEY"
                    className={validationErrors.key ? 'border-red-300' : ''}
                    disabled={isEditing} // Don't allow key changes when editing
                  />
                  {validationErrors.key && (
                    <p className="mt-1 text-sm text-red-600">{validationErrors.key}</p>
                  )}
                </div>

                {/* Description */}
                <div>
                  <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                    Description *
                  </label>
                  <textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => handleInputChange('description', (e.target as any).value)}
                    placeholder="Describe what this configuration is used for"
                    rows={3}
                    className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      validationErrors.description ? 'border-red-300' : ''
                    }`}
                  />
                  {validationErrors.description && (
                    <p className="mt-1 text-sm text-red-600">{validationErrors.description}</p>
                  )}
                </div>

                {/* Type and Category */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="type" className="block text-sm font-medium text-gray-700 mb-1">
                      Type
                    </label>
                    <select
                      id="type"
                      value={formData.type}
                      onChange={(e) => handleInputChange('type', (e.target as any).value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {getTypeOptions()?.filter(Boolean)?.map((option: any) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">
                      Category
                    </label>
                    <select
                      id="category"
                      value={formData.category}
                      onChange={(e) => handleInputChange('category', (e.target as any).value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {categories?.filter(Boolean)?.map((category: any) => (
                        <option key={category} value={category}>
                          {category.charAt(0).toUpperCase() + category.slice(1)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Environment */}
                <div>
                  <label htmlFor="environment" className="block text-sm font-medium text-gray-700 mb-1">
                    Environment
                  </label>
                  <select
                    id="environment"
                    value={formData.environment}
                    onChange={(e) => handleInputChange('environment', (e.target as any).value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {getEnvironmentOptions()?.filter(Boolean)?.map((option: any) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Flags */}
                <div className="space-y-3">
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={formData.isRequired}
                      onChange={(e) => handleInputChange('isRequired', (e.target as any).checked)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">Required configuration</span>
                  </label>

                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={formData.isSecret}
                      onChange={(e) => handleInputChange('isSecret', (e.target as any).checked)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700 flex items-center">
                      <Shield className="h-4 w-4 mr-1" />
                      Secret value (encrypted storage)
                    </span>
                  </label>
                </div>
              </div>

              {/* Right Column - Value and Validation */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                  Value & Validation
                </h3>

                {/* Value */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label htmlFor="value" className="block text-sm font-medium text-gray-700">
                      Value {formData.isRequired && '*'}
                    </label>
                    {formData.isSecret && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowValue((v) => !v)}
                      >
                        {showValue ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    )}
                  </div>
                  
                  {formData.type === 'json' || formData.type === 'array' ? (
                    <div>
                      <textarea
                        id="value"
                        value={formatValueForDisplay()}
                        onChange={(e) => handleValueChange((e.target as any).value)}
                        placeholder={formData.type === 'array' ? '[]' : '{}'}
                        rows={6}
                        className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm ${
                          validationErrors.value || jsonError ? 'border-red-300' : ''
                        }`}
                        style={{ display: showValue ? 'block' : 'none' }}
                      />
                      {!showValue && (
                        <div className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-500 font-mono text-sm">
                          ••••••••
                        </div>
                      )}
                    </div>
                  ) : formData.type === 'boolean' ? (
                    <select
                      id="value"
                      value={String(formData.value)}
                      onChange={(e) => handleInputChange('value', (e.target as any).value === 'true')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="true">True</option>
                      <option value="false">False</option>
                    </select>
                  ) : (
                    <Input
                      id="value"
                      type={formData.isSecret && !showValue ? 'password' : formData.type === 'number' ? 'number' : 'text'}
                      value={showValue ? String(formData.value) : '••••••••'}
                      onChange={(e) => handleValueChange((e.target as any).value)}
                      placeholder={`Enter ${formData.type} value`}
                      className={validationErrors.value ? 'border-red-300' : ''}
                      readOnly={formData.isSecret && !showValue}
                    />
                  )}
                  
                  {(validationErrors.value || jsonError) && (
                    <p className="mt-1 text-sm text-red-600">
                      {validationErrors.value || jsonError}
                    </p>
                  )}
                </div>

                {/* Default Value */}
                <div>
                  <label htmlFor="defaultValue" className="block text-sm font-medium text-gray-700 mb-1">
                    Default Value
                  </label>
                  <Input
                    id="defaultValue"
                    type="text"
                    value={String(formData.defaultValue || '')}
                    onChange={(e) => handleInputChange('defaultValue', (e.target as any).value)}
                    placeholder="Optional default value"
                  />
                </div>

                {/* Validation Rules */}
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Validation Rules</h4>
                  <div className="space-y-3">
                    {formData.type === 'number' && (
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Min Value</label>
                          <Input
                            type="number"
                            value={formData.validation?.min || ''}
                            onChange={(e) => handleValidationChange('min', (e.target as any).value ? Number((e.target as any).value) : undefined)}
                            placeholder="Min"
                            size="sm"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">Max Value</label>
                          <Input
                            type="number"
                            value={formData.validation?.max || ''}
                            onChange={(e) => handleValidationChange('max', (e.target as any).value ? Number((e.target as any).value) : undefined)}
                            placeholder="Max"
                            size="sm"
                          />
                        </div>
                      </div>
                    )}

                    {formData.type === 'string' && (
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Pattern (Regex)</label>
                        <Input
                          type="text"
                          value={formData.validation?.pattern || ''}
                          onChange={(e) => handleValidationChange('pattern', (e.target as any).value)}
                          placeholder="^[a-zA-Z0-9]+$"
                          size="sm"
                        />
                      </div>
                    )}

                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Allowed Values (comma-separated)</label>
                      <Input
                        type="text"
                        value={formData.validation?.enum?.join(', ') || ''}
                        onChange={(e) => {
                          const raw = (e.target as any).value as string
                          const arr = raw ? raw.split(',').map((v) => v.trim()).filter(Boolean) : undefined
                          handleValidationChange('enum', arr)
                        }}
                        placeholder="value1, value2, value3"
                        size="sm"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Form Actions */}
            <div className="flex items-center justify-end space-x-3 pt-6 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isLoading || !isDirty}
                className="min-w-[120px]"
              >
                {isLoading ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Saving...
                  </div>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    {isEditing ? 'Update Config' : 'Create Config'}
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

export default ConfigEditor
