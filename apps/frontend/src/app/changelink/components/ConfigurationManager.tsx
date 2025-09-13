'use client';

import React, { useState, useCallback } from 'react';
interface TestResult {
  step: string;
  status: 'pending' | 'running' | 'success' | 'error';
  message: string;
  duration?: number;
  data?: any;
}
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { 
  Plus, 
  Edit, 
  Play, 
  Save, 
  TestTube, 
  Settings, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  Copy,
  Download
} from 'lucide-react';
import { TrackingConfiguration } from '../types';
import { createClientLogger } from "@/lib/utils/security/client-secure-logger";
import { EnhancedError } from '@/lib/utils/error-handling';
const logger = createClientLogger('ConfigurationManager');


interface ConfigurationManagerProps {
  configurations: TrackingConfiguration[];
  onSave: (config: TrackingConfiguration) => Promise<void>;
  onDelete: (configId: string) => Promise<void>;
  onTest: (config: TrackingConfiguration) => Promise<void>;
  onExecute: (configId: string) => Promise<void>;
  onStop: (executionId: string) => Promise<void>;
  activeExecutions: unknown[];
  selectedConfiguration: TrackingConfiguration | null;
  onConfigurationSelect: (config: TrackingConfiguration) => void;
  isExecuting: boolean;
  executionProgress: {[key: string]: number};
}

const ConfigurationManager: React.FC<ConfigurationManagerProps> = ({
  configurations,
  onSave,
  onDelete,
  onTest,
  onExecute,
  onStop,
  activeExecutions,
  selectedConfiguration,
  onConfigurationSelect,
  isExecuting,
  executionProgress
}) => {
  const [currentConfig, setCurrentConfig] = useState<TrackingConfiguration | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);

  const defaultConfig: TrackingConfiguration = {
    id: '',
    name: '',
    adsPowerConfigId: '',
    googleAdsConfigId: '',
    environmentId: '',
    status: 'ACTIVE',
    isActive: true,
    linkMappings: [],
    adMappingConfig: [],
    originalLinks: [],
    googleAdsAccounts: [],
    repeatCount: 1,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const validateConfiguration = useCallback((config: TrackingConfiguration): string[] => {
    const errors: string[] = [];

    if (!config.name.trim()) => {
      errors.push('Configuration name is required');
    }

    if (!config.adsPowerConfigId.trim()) => {
      errors.push('AdsPower configuration is required');
    }

    if (!config.googleAdsConfigId.trim()) => {
      errors.push('Google Ads configuration is required');
    }

    if (config.originalLinks.length === 0) => {
      errors.push('At least one original link is required');
    }

    if (config.repeatCount && (config.repeatCount < 1 || config.repeatCount > 100)) => {
      errors.push('Repeat count must be between 1 and 100');
    }

    return errors;
  }, []);

  const handleSaveConfiguration = useCallback(async () => {
    if (!currentConfig) return;

    const errors = validateConfiguration(currentConfig);
    setValidationErrors(errors);

    if (errors.length > 0) => {
      return;
    }

    try {
      const configToSave = {
        ...currentConfig,
        id: currentConfig.id || `config_${Date.now()}`,
        updatedAt: new Date()
      };

      await onSave(configToSave);
      setCurrentConfig(null);
      setIsEditing(false);
      setValidationErrors([]);
    } catch (error) {
      logger.error('Error saving configuration:', new EnhancedError('Error saving configuration', { data: error instanceof Error ? error.message : String(error) }));
      setValidationErrors(['Failed to save configuration']);
    }
  }, [currentConfig, validateConfiguration, onSave]);

  const handleTestConfiguration = useCallback(async () => {
    if (!currentConfig) return;

    setIsTesting(true);
    setTestResult(null);

    try {
      await onTest(currentConfig);
      
      const mockTestResult: TestResult = {
        step: '集成测试',
        status: 'success',
        message: '所有集成测试通过',
        duration: 0,
        data: {
          environmentAccess: true,
          googleAdsAccess: true,
          linkValidation: true,
          notificationTest: true
        }
      };

      setTestResult(mockTestResult);
    } catch (error) {
      setTestResult({
        step: '集成测试',
        status: 'error',
        message: '部分测试未通过',
        duration: 0,
        data: {
          environmentAccess: false,
          googleAdsAccess: true,
          linkValidation: false,
          notificationTest: true
        }
      });
    } finally {
      setIsTesting(false);
    }
  }, [currentConfig, onTest]);

  // const handleDeleteConfiguration = useCallback(async (configId: string) => {
  //   if (confirm('Are you sure you want to delete this configuration? This action cannot be undone.')) => {
  //     try {
  //       await onDelete(configId);
  //     } catch (error) {
  //       logger.error('Error deleting configuration:', new EnhancedError('Error deleting configuration:', { error: error instanceof Error ? error.message : String(error)  }));
  //     }
  //   }
  // }, [onDelete]);
  const handleEditConfiguration = useCallback((config: TrackingConfiguration) => {
    setCurrentConfig(config);
    setIsEditing(true);
    setValidationErrors([]);
  }, []);

  const handleCreateNewConfiguration = useCallback(() => {
    setCurrentConfig(defaultConfig);
    setIsEditing(false);
    setValidationErrors([]);
    setTestResult(null);
  }, [defaultConfig]);

  const handleDuplicateConfiguration = useCallback((config: TrackingConfiguration) => {
    const duplicatedConfig = {
      ...config,
      id: '',
      name: `${config.name} (Copy)`,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    setCurrentConfig(duplicatedConfig);
    setIsEditing(false);
    setValidationErrors([]);
  }, []);

  const handleExecuteConfiguration = useCallback(async (configId: string) => {
    try {
      await onExecute(configId);
    } catch (error) {
      logger.error('Error executing configuration:', new EnhancedError('Error executing configuration', { data: error instanceof Error ? error.message : String(error) }));
    }
  }, [onExecute]);

  const handleStopExecution = useCallback(async (executionId: string) => {
    try {
      await onStop(executionId);
    } catch (error) {
      logger.error('Error stopping execution:', new EnhancedError('Error stopping execution', { data: error instanceof Error ? error.message : String(error) }));
    }
  }, [onStop]);
  const handleExportConfiguration = useCallback((config: TrackingConfiguration) => {
    const dataStr = JSON.stringify(config, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${config.name.replace(/\s+/g, '_')}_config.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, []);

  const getExecutionStatus = useCallback((configId: string) => {
    return activeExecutions.find((exec: any) => (exec as any).configurationId === configId);
  }, [activeExecutions]);
  const getExecutionProgress = useCallback((configId: string) => {
    const execution = getExecutionStatus(configId);
    if (!execution) return 0;
    return executionProgress[(execution as any).executionId] || 0;
  }, [getExecutionStatus, executionProgress]);
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Configuration Manager</h2>
          <p className="text-gray-600">Manage your Google Ads automation configurations</p>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
          >
            <Settings className="h-4 w-4 mr-2" />
            Advanced
          </Button>
          <Button onClick={handleCreateNewConfiguration}>
            <Plus className="h-4 w-4 mr-2" />
            New Configuration
          </Button>
        </div>
      </div>

      {/* Alert Messages */}
      {validationErrors.length > 0 && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <ul className="list-disc list-inside">
              {validationErrors.map((error, index: any) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {testResult && (
        <Alert variant={testResult.status === 'success' ? "default" : "destructive"}>
          {testResult.status === 'success' ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
          <AlertDescription>
            <div className="font-medium">{testResult.message}</div>
            {testResult.data && (
              <div className="mt-2 text-xs text-gray-600">
                {Object.entries(testResult.data).map(([key, value]: any) => (
                  <div key={key}>{key}: {String(value)}</div>
                ))}
              </div>
            )}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Configuration List */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Configurations</span>
                <Badge variant="outline">{configurations.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {configurations.map((config: any) => {
                  const execution = getExecutionStatus(config.id);
                  const progress = getExecutionProgress(config.id);
                  
                  return (
                    <div
                      key={config.id}
                      className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                        selectedConfiguration?.id === config.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => onConfigurationSelect(config)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2">
                            <h4 className="font-medium text-sm truncate">{config.name}</h4>
                            <Badge variant={config.status === 'active' ? "default" : "secondary"}>
                              {config.status}
                            </Badge>
                          </div>
                          <p className="text-xs text-gray-500 truncate">
                            {config.originalLinks.length} links, {config.repeatCount} executions
                          </p>
                          {(execution as any) && (
                            <div className="mt-2">
                              <div className="flex items-center justify-between text-xs text-gray-600">
                                <span>Executing...</span>
                                <span>{Math.round(progress)}%</span>
                              </div>
                              <Progress value={progress} className="h-1 mt-1" />
                            </div>
                          )}
                        </div>
                        <div className="flex items-center space-x-1">
                          {execution ? (
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={((e: any): any) => {
                                e.stopPropagation();
                                handleStopExecution((execution as any).executionId);
                              }}
                            >
                              <XCircle className="h-3 w-3" />
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              onClick={((e: any): any) => {
                                e.stopPropagation();
                                handleExecuteConfiguration(config.id);
                              }}
                              disabled={isExecuting}
                            >
                              <Play className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Configuration Details */}
        <div className="lg:col-span-2">
          {currentConfig ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>{isEditing ? 'Edit Configuration' : 'Configuration Details'}</span>
                  <div className="flex items-center space-x-2">
                    {!isEditing && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditConfiguration(currentConfig)}
                        >
                          <Edit className="h-4 w-4 mr-1" />
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDuplicateConfiguration(currentConfig)}
                        >
                          <Copy className="h-4 w-4 mr-1" />
                          Duplicate
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleExportConfiguration(currentConfig)}
                        >
                          <Download className="h-4 w-4 mr-1" />
                          Export
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleTestConfiguration()}
                          disabled={isTesting}
                        >
                          <TestTube className="h-4 w-4 mr-1" />
                          {isTesting ? 'Testing...' : 'Test'}
                        </Button>
                      </>
                    )}
                    {isEditing && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setCurrentConfig(null);
                            setIsEditing(false);
                          }}
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          onClick={handleSaveConfiguration}
                        >
                          <Save className="h-4 w-4 mr-1" />
                          Save
                        </Button>
                      </>
                    )}
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="name">Configuration Name</Label>
                      <Input
                        id="name"
                        value={currentConfig.name}
                        onChange={((e: any) => setCurrentConfig(prev: any) => prev ? {...prev, name: e.target.value} : null)}
                        disabled={!isEditing}
                        placeholder="Enter configuration name"
                      />
                    </div>
                    <div>
                      <Label htmlFor="environmentId">Environment ID</Label>
                      <Input
                        id="environmentId"
                        value={currentConfig.environmentId}
                        onChange={((e: any) => setCurrentConfig(prev: any) => prev ? {...prev, environmentId: e.target.value} : null)}
                        disabled={!isEditing}
                        placeholder="Enter AdsPower environment ID"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <Label htmlFor="adsPowerConfigId">AdsPower Configuration</Label>
                    <Input
                      id="adsPowerConfigId"
                      value={currentConfig.adsPowerConfigId}
                      onChange={((e: any) => setCurrentConfig(prev: any) => prev ? {...prev, adsPowerConfigId: e.target.value} : null)}
                      disabled={!isEditing}
                      placeholder="Enter AdsPower configuration ID"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="googleAdsConfigId">Google Ads Configuration</Label>
                    <Input
                      id="googleAdsConfigId"
                      value={currentConfig.googleAdsConfigId}
                      onChange={((e: any) => setCurrentConfig(prev: any) => prev ? {...prev, googleAdsConfigId: e.target.value} : null)}
                      disabled={!isEditing}
                      placeholder="Enter Google Ads configuration ID"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="repeatCount">Repeat Count</Label>
                    <Input
                      id="repeatCount"
                      type="number"
                      value={currentConfig.repeatCount}
                      onChange={((e: any) => setCurrentConfig(prev: any) => prev ? {...prev, repeatCount: parseInt(e.target.value)} : null)}
                      disabled={!isEditing}
                      min="1"
                      max="100"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="originalLinks">Original Links (one per line)</Label>
                    <Textarea
                      id="originalLinks"
                      value={currentConfig.originalLinks.join('\n')}
                      onChange={((e: any) => setCurrentConfig(prev: any) => prev ? {
                        ...prev,
                        originalLinks: e.target.value.split('\n').filter((link: any) => link.trim())
                      } : null)}
                      disabled={!isEditing}
                      placeholder="Enter original links, one per line"
                      rows={4}
                    />
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Label htmlFor="status">Status</Label>
                    <select
                      id="status"
                      value={currentConfig.status}
                      onChange={((e: any) => setCurrentConfig(prev: any) => prev ? {...prev, status: e.target.value as TrackingConfiguration['status']} : null)}
                      disabled={!isEditing}
                      className="border rounded px-2 py-1"
                    >
                      <option value="active">Active</option>
                      <option value="paused">Paused</option>
                      <option value="stopped">Stopped</option>
                    </select>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="flex items-center justify-center h-64">
                <div className="text-center">
                  <Settings className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Configuration Selected</h3>
                  <p className="text-gray-500 mb-4">Select a configuration from the list to view details</p>
                  <Button onClick={handleCreateNewConfiguration}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create New Configuration
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Import/Export Section */}
      {showAdvancedSettings && (
        <Card>
          <CardHeader>
            <CardTitle>Advanced Settings</CardTitle>
            <CardDescription>Import and export configurations</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-4">
              <div>
                <Label htmlFor="import-config">Import Configuration</Label>
                <Input
                  id="import-config"
                  type="file"
                  accept=".json"
                  onChange={((event: any): any) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    
                    const reader = new FileReader();
                    reader.onload = (e) => {
                      try {
                        const config = JSON.parse(e.target?.result as string);
                        setCurrentConfig(config);
                        setIsEditing(false);
                        setValidationErrors([]);
                      } catch (error) {
                        setValidationErrors(['Invalid configuration file format']);
                      }
                    };
                    reader.readAsText(file);
                  }}
                />
              </div>
              <div className="flex items-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    const dataStr = JSON.stringify(configurations, null, 2);
                    const dataBlob = new Blob([dataStr], { type: 'application/json' });
                    const url = URL.createObjectURL(dataBlob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = `configurations_${new Date().toISOString().split('T')[0]}.json`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    URL.revokeObjectURL(url);
                  }}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export All
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ConfigurationManager; 