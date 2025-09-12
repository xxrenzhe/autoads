'use client'

import React, { useState } from 'react'
import { EnvVarList } from './EnvVarList'
import { EnvVarEdit } from './EnvVarEdit'
import { EnvironmentVariable } from '../../hooks/useEnvVarManagement'

type ViewMode = 'list' | 'create' | 'edit'

export function EnvVarManager() {
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [selectedEnvVar, setSelectedEnvVar] = useState<EnvironmentVariable | undefined>()

  const handleCreate = () => {
    setSelectedEnvVar(undefined)
    setViewMode('create')
  }

  const handleEdit = (envVar: EnvironmentVariable) => {
    setSelectedEnvVar(envVar)
    setViewMode('edit')
  }

  const handleSave = () => {
    setViewMode('list')
    setSelectedEnvVar(undefined)
  }

  const handleCancel = () => {
    setViewMode('list')
    setSelectedEnvVar(undefined)
  }

  return (
    <div className="space-y-6">
      {viewMode === 'list' && (
        <EnvVarList
          onEdit={handleEdit}
          onCreate={handleCreate}
        />
      )}
      
      {(viewMode === 'create' || viewMode === 'edit') && (
        <EnvVarEdit
          envVar={selectedEnvVar}
          onSave={handleSave}
          onCancel={handleCancel}
        />
      )}
    </div>
  )
}