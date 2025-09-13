'use client';

import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Link, 
  Settings, 
  TestTube, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  RefreshCw,
  Plus,
  Edit,
  Trash2,
  Eye,
  EyeOff,
  Database,
  Mail,
  MessageSquare,
  FileText,
  Activity,
  Globe,
  Filter
} from 'lucide-react';

interface Integration {
  id: string;
  name: string;
  type: 'api' | 'webhook' | 'database' | 'email' | 'messaging' | 'analytics' | 'storage';
  provider: string;
  description: string;
  status: 'active' | 'inactive' | 'error' | 'testing';
  config: IntegrationConfig;
  lastSync?: Date;
  syncFrequency: 'realtime' | 'hourly' | 'daily' | 'weekly' | 'manual';
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, unknown>;
}

interface IntegrationConfig {
  endpoint?: string;
  apiKey?: string;
  secretKey?: string;
  username?: string;
  password?: string;
  database?: string;
  port?: number;
  ssl?: boolean;
  timeout?: number;
  retryAttempts?: number;
  headers?: Record<string, string>;
  webhookUrl?: string;
  webhookSecret?: string;
  customFields?: Record<string, unknown>;
}

interface IntegrationHubProps {
  onIntegrationCreated?: (integration: Integration) => void;
  onIntegrationUpdated?: (integration: Integration) => void;
  onIntegrationDeleted?: (integrationId: string) => void;
  onTestConnection?: (integration: Integration) => Promise<boolean>;
  onSyncData?: (integrationId: string) => Promise<boolean>;
}

const IntegrationHub: React.FC<IntegrationHubProps> = ({
  onIntegrationCreated,
  onIntegrationUpdated,
  onIntegrationDeleted,
  onTestConnection,
  onSyncData
}) => {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [currentIntegration, setCurrentIntegration] = useState<Integration | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [activeTab, setActiveTab] = useState('integrations');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [showSecrets, setShowSecrets] = useState(false);
  const [operationResult, setOperationResult] = useState<{
    success: boolean;
    message: string;
    details?: unknown;
  } | null>(null);

  // Mock integrations
  const mockIntegrations: Integration[] = [
    {
      id: 'int_1',
      name: 'Google Ads API',
      type: 'api',
      provider: 'Google',
      description: 'Google Ads API integration for campaign management',
      status: 'active',
      config: {
        endpoint: 'https://googleads.googleapis.com/v14',
        apiKey: 'sk-google-ads-api-key-123',
        timeout: 30,
        retryAttempts: 3,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer sk-google-ads-api-key-123'
        }
      },
      lastSync: new Date(Date.now() - 2 * 60 * 60 * 1000),
      syncFrequency: 'hourly',
      createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      updatedAt: new Date()
    },
    {
      id: 'int_2',
      name: 'Slack Notifications',
      type: 'messaging',
      provider: 'Slack',
      description: 'Slack webhook for sending notifications',
      status: 'active',
      config: {
        webhookUrl: process.env.SLACK_WEBHOOK_URL || 'https://hooks.slack.com/services/YOUR_WORKSPACE/YOUR_CHANNEL/YOUR_TOKEN',
        webhookSecret: 'slack-webhook-secret-123',
        timeout: 10,
        retryAttempts: 2
      },
      lastSync: new Date(Date.now() - 30 * 60 * 1000),
      syncFrequency: 'realtime',
      createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
      updatedAt: new Date()
    },
    {
      id: 'int_3',
      name: 'PostgreSQL Database',
      type: 'database',
      provider: 'PostgreSQL',
      description: 'Main application database connection',
      status: 'active',
      config: {
        endpoint: 'localhost',
        port: 5432,
        database: 'google_ads_automation',
        username: 'db_user',
        password: 'db_password_123',
        ssl: true,
        timeout: 60
      },
      lastSync: new Date(Date.now() - 5 * 60 * 1000),
      syncFrequency: 'realtime',
      createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
      updatedAt: new Date()
    },
    {
      id: 'int_4',
      name: 'Email Service',
      type: 'email',
      provider: 'SendGrid',
      description: 'Email delivery service for notifications',
      status: 'active',
      config: {
        endpoint: 'https://api.sendgrid.com/v3',
        apiKey: 'SG.sendgrid-api-key-123',
        timeout: 15,
        retryAttempts: 3
      },
      lastSync: new Date(Date.now() - 1 * 60 * 60 * 1000),
      syncFrequency: 'hourly',
      createdAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
      updatedAt: new Date()
    },
    {
      id: 'int_5',
      name: 'Analytics Dashboard',
      type: 'analytics',
      provider: 'Google Analytics',
      description: 'Google Analytics integration for tracking',
      status: 'error',
      config: {
        endpoint: 'https://analytics.googleapis.com/v3',
        apiKey: 'ga-api-key-123',
        timeout: 20,
        retryAttempts: 2
      },
      lastSync: new Date(Date.now() - 24 * 60 * 60 * 1000),
      syncFrequency: 'daily',
      createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      updatedAt: new Date(),
      metadata: {
        errorMessage: 'API key expired',
        lastError: '2024-01-15 14:30:00'
      }
    }
  ];

  React.useEffect(() => {
    setIntegrations(mockIntegrations);
  }, []);

  const defaultIntegration: Integration = {
    id: '',
    name: '',
    type: 'api',
    provider: '',
    description: '',
    status: 'inactive',
    config: {},
    syncFrequency: 'manual',
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const handleCreateIntegration = useCallback(() => {
    setCurrentIntegration(defaultIntegration);
    setIsCreating(true);
    setIsEditing(false);
    setOperationResult(null);
  }, []);
  
  const handleEditIntegration = useCallback((integration: Integration) => {
    setCurrentIntegration(integration);
    setIsEditing(true);
    setIsCreating(false);
    setOperationResult(null);
  }, []);

  const handleSaveIntegration = useCallback(async () => {
    if (!currentIntegration) return;

    try {
      if (isCreating) {
        const newIntegration = {
          ...currentIntegration,
          id: `int_${Date.now()}`,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        setIntegrations(prev => [...prev, newIntegration]);
        onIntegrationCreated?.(newIntegration);
      } else {
        const updatedIntegration = {
          ...currentIntegration,
          updatedAt: new Date()
        };
        setIntegrations(prev => prev?.filter(Boolean)?.map((int: any) => int.id === updatedIntegration.id ? updatedIntegration : int));
        onIntegrationUpdated?.(updatedIntegration);
      }

      setOperationResult({ 
        success: true,
        message: isCreating ? 'Integration created successfully' : 'Integration updated successfully'
      });
      setCurrentIntegration(null);
      setIsCreating(false);
      setIsEditing(false);
    } catch (error) {
      setOperationResult({
        success: false,
        message: 'Failed to save integration',
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      });
    }
  }, [currentIntegration, isCreating, onIntegrationCreated, onIntegrationUpdated]);
  
  const handleDeleteIntegration = useCallback((integrationId: string) => {
    if (confirm('Are you sure you want to delete this integration? This action cannot be undone.')) {
      setIntegrations(prev => prev.filter((int: any) => int.id !== integrationId));
      onIntegrationDeleted?.(integrationId);
      setOperationResult({
        success: true,
        message: 'Integration deleted successfully'
      });
    }
  }, [onIntegrationDeleted]);
  const handleTestConnection = useCallback(async (integration: Integration) => {
    setIsTesting(true);
    setOperationResult(null);

    try {
      const success = await onTestConnection?.(integration) ?? true;
      setOperationResult({
        success,
        message: success ? 'Connection test successful' : 'Connection test failed',
        details: { integrationId: integration.id, timestamp: new Date().toISOString() }
      });
    } catch (error) {
      setOperationResult({
        success: false,
        message: 'Connection test error',
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      });
    } finally {
      setIsTesting(false);
    }
  }, [onTestConnection]);
  
  const handleSyncData = useCallback(async (integrationId: string) => {
    setIsSyncing(true);
    setOperationResult(null);

    try {
      const success = await onSyncData?.(integrationId) ?? true;
      if (success) {
        setIntegrations(prev => prev?.filter(Boolean)?.map((int: any) => 
          int.id === integrationId 
            ? { ...int, lastSync: new Date(), status: 'active' as const }
            : int
        ));
      }
      setOperationResult({
        success,
        message: success ? 'Data sync completed' : 'Data sync failed',
        details: { integrationId, timestamp: new Date().toISOString() }
      });
    } catch (error) {
      setOperationResult({
        success: false,
        message: 'Data sync error',
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      });
    } finally {
      setIsSyncing(false);
    }
  }, [onSyncData]);
  
  const handleCancel = useCallback(() => {
    setCurrentIntegration(null);
    setIsCreating(false);
    setIsEditing(false);
    setOperationResult(null);
  }, []);

  const filteredIntegrations = integrations.filter((integration: any) => { 
    const matchesType = selectedType === 'all' || integration.type === selectedType;
    const matchesStatus = selectedStatus === 'all' || integration.status === selectedStatus;
    return matchesType && matchesStatus;
  });
  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'api': return <Globe className="h-4 w-4" />;
      case 'webhook': return <Link className="h-4 w-4" />;
      case 'database': return <Database className="h-4 w-4" />;
      case 'email': return <Mail className="h-4 w-4" />;
      case 'messaging': return <MessageSquare className="h-4 w-4" />;
      case 'analytics': return <Activity className="h-4 w-4" />;
      case 'storage': return <FileText className="h-4 w-4" />;
      default: return <Settings className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-green-600 bg-green-50';
      case 'inactive': return 'text-gray-600 bg-gray-50';
      case 'error': return 'text-red-600 bg-red-50';
      case 'testing': return 'text-yellow-600 bg-yellow-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getSyncFrequencyColor = (frequency: string) => {
    switch (frequency) {
      case 'realtime': return 'text-blue-600 bg-blue-50';
      case 'hourly': return 'text-green-600 bg-green-50';
      case 'daily': return 'text-orange-600 bg-orange-50';
      case 'weekly': return 'text-purple-600 bg-purple-50';
      case 'manual': return 'text-gray-600 bg-gray-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleString();
  };

  const formatDuration = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return 'Just now';
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Integration Hub</h2>
          <p className="text-muted-foreground">
            Manage third-party integrations and API connections
          </p>
        </div>
        <Button onClick={handleCreateIntegration} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Add Integration
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
          <TabsTrigger value="monitoring">Monitoring</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
        </TabsList>

        <TabsContent value="integrations" className="space-y-6">
          {/* Filters */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Filters
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Select value={selectedType} onValueChange={setSelectedType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="api">API</SelectItem>
                    <SelectItem value="webhook">Webhook</SelectItem>
                    <SelectItem value="database">Database</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="messaging">Messaging</SelectItem>
                    <SelectItem value="analytics">Analytics</SelectItem>
                    <SelectItem value="storage">Storage</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="error">Error</SelectItem>
                    <SelectItem value="testing">Testing</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Integration List */}
            <div className="lg:col-span-1">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Link className="h-5 w-5" />
                    Integrations ({filteredIntegrations.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {filteredIntegrations.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Link className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>No integrations found</p>
                      </div>
                    ) : (
                      filteredIntegrations.map((integration: any) => (
                        <div
                          key={integration.id}
                          className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                            currentIntegration?.id === integration.id
                              ? 'border-primary bg-primary/5'
                              : 'border-border hover:border-primary/50'
                          }`}
                          onClick={() => setCurrentIntegration(integration)}
                        >
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                {getTypeIcon(integration.type)}
                                <h4 className="font-medium">{integration.name}</h4>
                              </div>
                              <p className="text-sm text-muted-foreground mb-2">
                                {integration.description}
                              </p>
                              <div className="flex items-center gap-2 mb-2">
                                <Badge className={getStatusColor(integration.status)}>
                                  {integration.status}
                                </Badge>
                                <Badge className={getSyncFrequencyColor(integration.syncFrequency)}>
                                  {integration.syncFrequency}
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  {integration.provider}
                                </span>
                              </div>
                              {integration.lastSync && (
                                <p className="text-xs text-muted-foreground">
                                  Last sync: {formatDuration(integration.lastSync)}
                                </p>
                              )}
                            </div>
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                          onClick={(e) => {
                              e.stopPropagation();
                              handleTestConnection(integration);
                            }}
                                disabled={isTesting}
                              >
                                <TestTube className="h-3 w-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                          onClick={(e) => {
                              e.stopPropagation();
                              handleSyncData(integration.id);
                            }}
                                disabled={isSyncing}
                              >
                                <RefreshCw className="h-3 w-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={(e: any) => {
                                  e.stopPropagation();
                                  handleEditIntegration(integration);
                                }}
                              >
                                <Edit className="h-3 w-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={(e: any) => {
                                  e.stopPropagation();
                                  handleDeleteIntegration(integration.id);
                                }}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Integration Editor */}
            <div className="lg:col-span-1">
              {currentIntegration ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      {isCreating ? <Plus className="h-5 w-5" /> : <Edit className="h-5 w-5" />}
                      {isCreating ? 'New Integration' : 'Edit Integration'}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="name">Name *</Label>
                        <Input
                          id="name"
                          value={currentIntegration.name}
                          onChange={(e) => setCurrentIntegration(prev => prev ? { ...prev, name: e.target.value } : null)}
                        />
                      </div>
                      <div>
                        <Label htmlFor="type">Type</Label>
                        <Select
                          value={currentIntegration.type}
                          onValueChange={(value: 'email' | 'api' | 'database' | 'webhook' | 'storage' | 'analytics' | 'messaging') => setCurrentIntegration(prev => prev ? { ...prev, type: value } : null)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="api">API</SelectItem>
                            <SelectItem value="webhook">Webhook</SelectItem>
                            <SelectItem value="database">Database</SelectItem>
                            <SelectItem value="email">Email</SelectItem>
                            <SelectItem value="messaging">Messaging</SelectItem>
                            <SelectItem value="analytics">Analytics</SelectItem>
                            <SelectItem value="storage">Storage</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="provider">Provider</Label>
                      <Input
                        id="provider"
                        value={currentIntegration.provider}
                        onChange={(e) => setCurrentIntegration(prev => prev ? { ...prev, provider: e.target.value } : null)}
                      />
                    </div>

                    <div>
                      <Label htmlFor="description">Description</Label>
                      <Textarea
                        id="description"
                        value={currentIntegration.description}
                        onChange={(e) => setCurrentIntegration(prev => prev ? { ...prev, description: e.target.value } : null)}
                        rows={3}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="status">Status</Label>
                        <Select
                          value={currentIntegration.status}
          onValueChange={(value) => setCurrentIntegration(prev => prev ? { ...prev, status: value as 'active' | 'inactive' | 'error' | 'testing' } : null)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="inactive">Inactive</SelectItem>
                            <SelectItem value="error">Error</SelectItem>
                            <SelectItem value="testing">Testing</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="sync-frequency">Sync Frequency</Label>
                        <Select
                          value={currentIntegration.syncFrequency}
                          onValueChange={(value) => setCurrentIntegration(prev => prev ? { ...prev, syncFrequency: value as 'realtime' | 'hourly' | 'daily' | 'weekly' | 'manual' } : null)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="realtime">Real-time</SelectItem>
                            <SelectItem value="hourly">Hourly</SelectItem>
                            <SelectItem value="daily">Daily</SelectItem>
                            <SelectItem value="weekly">Weekly</SelectItem>
                            <SelectItem value="manual">Manual</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <Label>Configuration</Label>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowSecrets(!showSecrets)}
                        >
                          {showSecrets ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="endpoint">Endpoint</Label>
                          <Input
                            id="endpoint"
                            value={currentIntegration.config.endpoint || ''}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCurrentIntegration(prev => prev ? {
                              ...prev,
                              config: { ...prev.config, endpoint: e.target.value }
                            } : null)}
                          />
                        </div>
                        <div>
                          <Label htmlFor="api-key">API Key</Label>
                          <Input
                            id="api-key"
                            type={showSecrets ? 'text' : 'password'}
                            value={currentIntegration.config.apiKey || ''}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCurrentIntegration(prev => prev ? {
                              ...prev,
                              config: { ...prev.config, apiKey: e.target.value }
                            } : null)}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="username">Username</Label>
                          <Input
                            id="username"
                            value={currentIntegration.config.username || ''}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCurrentIntegration(prev => prev ? {
                              ...prev,
                              config: { ...prev.config, username: e.target.value }
                            } : null)}
                          />
                        </div>
                        <div>
                          <Label htmlFor="password">Password</Label>
                          <Input
                            id="password"
                            type={showSecrets ? 'text' : 'password'}
                            value={currentIntegration.config.password || ''}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCurrentIntegration(prev => prev ? {
                              ...prev,
                              config: { ...prev.config, password: e.target.value }
                            } : null)}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="timeout">Timeout (seconds)</Label>
                          <Input
                            id="timeout"
                            type="number"
                            value={currentIntegration.config.timeout || 30}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCurrentIntegration(prev => prev ? {
                              ...prev,
                              config: { ...prev.config, timeout: parseInt(e.target.value) }
                            } : null)}
                          />
                        </div>
                        <div>
                          <Label htmlFor="retry-attempts">Retry Attempts</Label>
                          <Input
                            id="retry-attempts"
                            type="number"
                            value={currentIntegration.config.retryAttempts || 3}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCurrentIntegration(prev => prev ? {
                              ...prev,
                              config: { ...prev.config, retryAttempts: parseInt(e.target.value) }
                            } : null)}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button onClick={handleSaveIntegration} className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4" />
                        {isCreating ? 'Create Integration' : 'Update Integration'}
                      </Button>
                      <Button variant="ghost" onClick={handleCancel}>
                        Cancel
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <Link className="h-16 w-16 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium mb-2">No Integration Selected</h3>
                    <p className="text-muted-foreground text-center mb-4">
                      Select an integration from the list or create a new one to get started
                    </p>
                    <Button onClick={handleCreateIntegration} className="flex items-center gap-2">
                      <Plus className="h-4 w-4" />
                      Create New Integration
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="monitoring" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Integration Monitoring
              </CardTitle>
              <CardDescription>
                Monitor integration health and performance
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {integrations.map((integration: any) => (
                  <div key={integration.id} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        {getTypeIcon(integration.type)}
                        <h4 className="font-medium">{integration.name}</h4>
                        <Badge className={getStatusColor(integration.status)}>
                          {integration.status}
                        </Badge>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleTestConnection(integration)}
                          disabled={isTesting}
                        >
                          {isTesting ? (
                            <RefreshCw className="h-3 w-3 animate-spin" />
                          ) : (
                            <TestTube className="h-3 w-3" />
                          )}
                          Test
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleSyncData(integration.id)}
                          disabled={isSyncing}
                        >
                          {isSyncing ? (
                            <RefreshCw className="h-3 w-3 animate-spin" />
                          ) : (
                            <RefreshCw className="h-3 w-3" />
                          )}
                          Sync
                        </Button>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Provider:</span>
                        <p className="font-medium">{integration.provider}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Last Sync:</span>
                        <p className="font-medium">
                          {integration.lastSync ? formatDuration(integration.lastSync) : 'Never'}
                        </p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Frequency:</span>
                        <p className="font-medium capitalize">{integration.syncFrequency}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Status:</span>
                        <p className="font-medium capitalize">{integration.status}</p>
                      </div>
                    </div>

                    {typeof integration.metadata?.errorMessage === 'string' && integration.metadata?.errorMessage && (
                      <Alert variant="destructive" className="mt-3">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>
                          <div className="font-medium">Error: {String(integration.metadata.errorMessage)}</div>
                          {Boolean(integration.metadata.lastError) && (
                            <div className="text-sm mt-1">
                              Last error: {String(integration.metadata.lastError)}
                            </div>
                          )}
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="templates" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Integration Templates
              </CardTitle>
              <CardDescription>
                Pre-configured integration templates for common services
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[
                  { name: 'Google Ads API', type: 'api', provider: 'Google', description: 'Google Ads API integration template' },
                  { name: 'Slack Webhook', type: 'messaging', provider: 'Slack', description: 'Slack notification webhook template' },
                  { name: 'PostgreSQL', type: 'database', provider: 'PostgreSQL', description: 'PostgreSQL database connection template' },
                  { name: 'SendGrid Email', type: 'email', provider: 'SendGrid', description: 'SendGrid email service template' },
                  { name: 'Google Analytics', type: 'analytics', provider: 'Google', description: 'Google Analytics integration template' },
                  { name: 'AWS S3', type: 'storage', provider: 'AWS', description: 'AWS S3 storage integration template' }
                ].map((template, index) => (
                  <div key={index} className="p-4 border rounded-lg hover:border-primary/50 transition-colors">
                    <div className="flex items-center gap-2 mb-2">
                      {getTypeIcon(template.type)}
                      <h4 className="font-medium">{template.name}</h4>
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">
                      {template.description}
                    </p>
                    <div className="flex items-center justify-between">
                      <Badge variant="outline">{template.provider}</Badge>
                      <Button size="sm" variant="outline">
                        Use Template
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {operationResult && (
        <Alert variant={operationResult.success ? 'default' : 'destructive'}>
          {operationResult.success ? (
            <CheckCircle className="h-4 w-4" />
          ) : (
            <XCircle className="h-4 w-4" />
          )}
          <AlertDescription>
            <div className="font-medium">{operationResult.message}</div>
            {Boolean(operationResult.details) && (
              <div className="mt-2 text-sm">
                {Object.entries(operationResult.details as Record<string, unknown>).map(([key, value]) => (
                  <div key={key} className="flex justify-between">
                    <span className="capitalize">{key}:</span>
                    <span>{String(value)}</span>
                  </div>
                ))}
              </div>
            )}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};

export default IntegrationHub; 
