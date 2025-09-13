'use client'
import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/Card'
import { Button } from '@/shared/components/ui/Button'
import { Input } from '@/shared/components/ui/Input'
import { Badge } from '../ui/badge'
import { 
  User as UserIcon, 
  Mail, 
  Save, 
  X,
  Upload,
  AlertCircle,
  Check
} from 'lucide-react'
import { User } from './UserList'

export interface UserFormProps {
  user?: User | null
  onSave: (userData: Partial<User>) => Promise<void>
  onCancel: () => void
  isLoading?: boolean
  error?: string | null
}

export interface UserFormData {
  name: string
  email: string
  role: string
  status: 'active' | 'inactive' | 'suspended' | 'pending'
  avatar?: string
  metadata?: Record<string, any>
}

export function UserForm({
  user,
  onSave,
  onCancel,
  isLoading = false,
  error = null
}: UserFormProps) {
  const [formData, setFormData] = useState<UserFormData>({
    name: '',
    email: '',
    role: 'user',
    status: 'active',
    metadata: {}
  })
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})
  const [isDirty, setIsDirty] = useState(false)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)

  const isEditing = !!user

  // Initialize form data when user prop changes
  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        avatar: user.avatar,
        metadata: user.metadata || {}
      })
      setAvatarPreview(user.avatar || null)
    } else {
      setFormData({
        name: '',
        email: '',
        role: 'user',
        status: 'active',
        metadata: {}
      })
      setAvatarPreview(null)
    }
    setIsDirty(false)
    setValidationErrors({})
  }, [user])

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {}

    // Name validation
    if (!formData.name.trim()) {
      errors.name = 'Name is required'
    } else if (formData.name.trim().length < 2) {
      errors.name = 'Name must be at least 2 characters'
    }

    // Email validation
    if (!formData.email.trim()) {
      errors.email = 'Email is required'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'Please enter a valid email address'
    }

    // Role validation
    if (!formData.role) {
      errors.role = 'Role is required'
    }

    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleInputChange = (field: keyof UserFormData, value: any) => {
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
  }

  const handleMetadataChange = (key: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      metadata: {
        ...prev.metadata,
        [key]: value
      }
    }))
    setIsDirty(true)
  }

  const handleAvatarChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        setValidationErrors(prev => ({
          ...prev,
          avatar: 'Avatar file size must be less than 5MB'
        }))
        return
      }

      if (!file.type.startsWith('image/')) {
        setValidationErrors(prev => ({
          ...prev,
          avatar: 'Avatar must be an image file'
        }))
        return
      }

      setAvatarFile(file)
      
      // Create preview
      const reader = new FileReader()
      reader.onload = (e) => {
        setAvatarPreview(e.target?.result as string)
      }
      reader.readAsDataURL(file)
      
      setIsDirty(true)
      
      // Clear avatar validation error
      if (validationErrors.avatar) {
        setValidationErrors(prev => {
          const newErrors = { ...prev }
          delete newErrors.avatar
          return newErrors
        })
      }
    }
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    
    if (!validateForm()) {
      return
    }

    try {
      const userData: Partial<User> = {
        name: formData.name.trim(),
        email: formData.email.trim(),
        role: formData.role,
        status: formData.status,
        metadata: formData.metadata
      }

      // Handle avatar upload if there's a new file
      if (avatarFile) {
        // In a real implementation, you would upload the file to a storage service
        // and get back a URL. For now, we'll use the preview URL.
        userData.avatar = avatarPreview || undefined
      } else if (formData.avatar) {
        userData.avatar = formData.avatar
      }

      await onSave(userData)
    } catch (err) {
      // Error handling is done by the parent component
      console.error('Error saving user:', err)
    }
  }

  const availableRoles = [
    { value: 'user', label: 'User' },
    { value: 'admin', label: 'Admin' },
    { value: 'moderator', label: 'Moderator' },
    { value: 'editor', label: 'Editor' }
  ]

  const availableStatuses = [
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' },
    { value: 'suspended', label: 'Suspended' },
    { value: 'pending', label: 'Pending' }
  ]

  return (
    <div className="max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <UserIcon className="h-5 w-5 mr-2" />
            {isEditing ? 'Edit User' : 'Create New User'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Error Display */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-md p-4">
                <div className="flex">
                  <AlertCircle className="h-5 w-5 text-red-400" />
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800">
                      Error saving user
                    </h3>
                    <p className="mt-1 text-sm text-red-700">{error}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Avatar Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Avatar
              </label>
              <div className="flex items-center space-x-4">
                <div className="flex-shrink-0">
                  {avatarPreview ? (
                    <img
                      className="h-16 w-16 rounded-full object-cover"
                      src={avatarPreview}
                      alt="Avatar preview"
                    />
                  ) : (
                    <div className="h-16 w-16 rounded-full bg-gray-300 flex items-center justify-center">
                      <UserIcon className="h-8 w-8 text-gray-600" />
                    </div>
                  )}
                </div>
                <div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarChange}
                    className="hidden"
                    id="avatar-upload"
                  />
                  <label
                    htmlFor="avatar-upload"
                    className="cursor-pointer inline-flex items-center px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Upload Avatar
                  </label>
                  <p className="mt-1 text-xs text-gray-500">
                    PNG, JPG up to 5MB
                  </p>
                </div>
              </div>
              {validationErrors.avatar && (
                <p className="mt-1 text-sm text-red-600">{validationErrors.avatar}</p>
              )}
            </div>

            {/* Basic Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                  Name *
                </label>
                <Input
                  id="name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  placeholder="Enter full name"
                  className={validationErrors.name ? 'border-red-300' : ''}
                />
                {validationErrors.name && (
                  <p className="mt-1 text-sm text-red-600">{validationErrors.name}</p>
                )}
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  Email *
                </label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  placeholder="Enter email address"
                  className={validationErrors.email ? 'border-red-300' : ''}
                />
                {validationErrors.email && (
                  <p className="mt-1 text-sm text-red-600">{validationErrors.email}</p>
                )}
              </div>
            </div>

            {/* Role and Status */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-1">
                  Role *
                </label>
                <select
                  id="role"
                  value={formData.role}
                  onChange={(e) => handleInputChange('role', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {availableRoles.map((role: any) => (
                    <option key={role.value} value={role.value}>
                      {role.label}
                    </option>
                  ))}
                </select>
                {validationErrors.role && (
                  <p className="mt-1 text-sm text-red-600">{validationErrors.role}</p>
                )}
              </div>

              <div>
                <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-1">
                  Status
                </label>
                <select
                  id="status"
                  value={formData.status}
                  onChange={(e) => handleInputChange('status', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {availableStatuses.map((status: any) => (
                    <option key={status.value} value={status.value}>
                      {status.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Metadata */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Additional Information
              </label>
              <div className="space-y-2">
                {Object.entries(formData.metadata || {}).map(([key, value]: any) => (
                  <div key={key} className="flex items-center space-x-2">
                    <Input
                      value={key}
                      onChange={(e) => {
                        const newKey = e.target.value
                        const newMetadata = { ...formData.metadata }
                        delete newMetadata[key]
                        newMetadata[newKey] = value
                        handleInputChange('metadata', newMetadata)
                      }}
                      placeholder="Key"
                      className="flex-1"
                    />
                    <Input
                      value={String(value)}
                      onChange={(e) => handleMetadataChange(key, e.target.value)}
                      placeholder="Value"
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const newMetadata = { ...formData.metadata }
                        delete newMetadata[key]
                        handleInputChange('metadata', newMetadata)
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const newKey = `field_${Date.now()}`
                    handleMetadataChange(newKey, '')
                  }}
                >
                  Add Field
                </Button>
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
                className="min-w-[100px]"
              >
                {isLoading ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Saving...
                  </div>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    {isEditing ? 'Update User' : 'Create User'}
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

export default UserForm
