'use client';

import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Settings, 
  Shield, 
  Zap, 
  Database,
  Network, 
  Clock, 
  User, 
  Lock, 
  Eye, 
  EyeOff,
  Save,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  XCircle,
  HardDrive,
  Cpu,
  Activity,
  Bell
} from 'lucide-react';

interface SystemConfig {
  general: {
    systemName: string;
    timezone: string;
    language: string;
    dateFormat: string;
    timeFormat: string;
    autoSave: boolean;
    debugMode: boolean;
  };
  security: {
    sessionTimeout: number;
    maxLoginAttempts: number;
    passwordPolicy: {
      minLength: number;
      requireUppercase: boolean;
      requireLowercase: boolean;
      requireNumbers: boolean;
      requireSpecialChars: boolean;
    };
    twoFactorAuth: boolean;
    ipWhitelist: string[];
    encryptionLevel: 'basic' | 'standard' | 'high';
  };
  performance: {
    maxConcurrentExecutions: number;
    executionTimeout: number;
    retryAttempts: number;
    retryDelay: number;
    cacheEnabled: boolean;
    cacheSize: number;
    logLevel: 'debug' | 'info' | 'warn' | 'error';
    autoCleanup: boolean;
    cleanupInterval: number;
  };
  database: {
    connectionPool: number;
    queryTimeout: number;
    backupEnabled: boolean;
    backupFrequency: 'daily' | 'weekly' | 'monthly';
    backupRetention: number;
    autoOptimize: boolean;
  };
  notifications: {
    emailEnabled: boolean;
    slackEnabled: boolean;
    webhookEnabled: boolean;
    defaultRecipients: string[];
    alertThreshold: number;
    quietHours: {
      enabled: boolean;
      start: string;
      end: string;
    };
    rules?: Array<{ eventType: string; channel: 'inapp' | 'email' | 'webhook'; enabled: boolean }>;
  };
}

interface SystemSettingsProps {
  onSave?: (config: SystemConfig) => Promise<boolean>;
  onReset?: () => Promise<boolean>;
  onTestConnection?: (type: string) => Promise<boolean>;
}

const SystemSettings: React.FC<SystemSettingsProps> = ({
  onSave,
  onReset,
  onTestConnection
}) => {
  const [config, setConfig] = useState<SystemConfig>({
    general: {
      systemName: 'Google Ads Automation Platform',
      timezone: 'Asia/Shanghai',
      language: 'en',
      dateFormat: 'YYYY-MM-DD',
      timeFormat: 'HH:mm:ss',
      autoSave: true,
      debugMode: false
    },
    security: {
      sessionTimeout: 30,
      maxLoginAttempts: 5,
      passwordPolicy: {
        minLength: 8,
        requireUppercase: true,
        requireLowercase: true,
        requireNumbers: true,
        requireSpecialChars: false
      },
      twoFactorAuth: false,
      ipWhitelist: [],
      encryptionLevel: 'standard'
    },
    performance: {
      maxConcurrentExecutions: 5,
      executionTimeout: 300,
      retryAttempts: 3,
      retryDelay: 1000,
      cacheEnabled: true,
      cacheSize: 100,
      logLevel: 'info',
      autoCleanup: true,
      cleanupInterval: 24
    },
    database: {
      connectionPool: 10,
      queryTimeout: 30,
      backupEnabled: true,
      backupFrequency: 'daily',
      backupRetention: 30,
      autoOptimize: true
    },
    notifications: {
      emailEnabled: true,
      slackEnabled: false,
      webhookEnabled: false,
      defaultRecipients: ['admin@example.com'],
      alertThreshold: 5,
      quietHours: {
        enabled: false,
        start: '22:00',
        end: '08:00'
      }
    }
  });

  const [isSaving, setIsSaving] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [operationResult, setOperationResult] = useState<{
    success: boolean;
    message: string;
    details?: unknown;
  } | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    setOperationResult(null);

    try {
      const success = await onSave?.(config) ?? true;
      setOperationResult({
        success,
        message: success ? 'Settings saved successfully' : 'Failed to save settings',
        details: { timestamp: new Date().toISOString() }
      });
    } catch (error) {
      setOperationResult({
        success: false,
        message: 'Error saving settings',
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      });
    } finally {
      setIsSaving(false);
    }
  }, [config, onSave]);
  const handleReset = useCallback(async () => {
    if (!confirm('Are you sure you want to reset all settings to default values? This action cannot be undone.')) {
      return;
    }

    setIsResetting(true);
    setOperationResult(null);

    try {
      const success = await onReset?.() ?? true;
      if (success) {
        // Reset to default config
        setConfig({
          general: {
            systemName: 'Google Ads Automation Platform',
            timezone: 'Asia/Shanghai',
            language: 'en',
            dateFormat: 'YYYY-MM-DD',
            timeFormat: 'HH:mm:ss',
            autoSave: true,
            debugMode: false
          },
          security: {
            sessionTimeout: 30,
            maxLoginAttempts: 5,
            passwordPolicy: {
              minLength: 8,
              requireUppercase: true,
              requireLowercase: true,
              requireNumbers: true,
              requireSpecialChars: false
            },
            twoFactorAuth: false,
            ipWhitelist: [],
            encryptionLevel: 'standard'
          },
          performance: {
            maxConcurrentExecutions: 5,
            executionTimeout: 300,
            retryAttempts: 3,
            retryDelay: 1000,
            cacheEnabled: true,
            cacheSize: 100,
            logLevel: 'info',
            autoCleanup: true,
            cleanupInterval: 24
          },
          database: {
            connectionPool: 10,
            queryTimeout: 30,
            backupEnabled: true,
            backupFrequency: 'daily',
            backupRetention: 30,
            autoOptimize: true
          },
          notifications: {
            emailEnabled: true,
            slackEnabled: false,
            webhookEnabled: false,
            defaultRecipients: ['admin@example.com'],
            alertThreshold: 5,
            quietHours: {
              enabled: false,
              start: '22:00',
              end: '08:00'
            }
          }
        });
      }

      setOperationResult({ success,
        message: success ? 'Settings reset successfully' : 'Failed to reset settings'
      });
    } catch (error) {
      setOperationResult({
        success: false,
        message: 'Error resetting settings',
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      });
    } finally {
      setIsResetting(false);
    }
  }, [onReset]);
  const handleTestConnection = useCallback(async (type: string) => {
    setIsTesting(true);
    setOperationResult(null);

    try {
      const success = await onTestConnection?.(type) ?? true;
      setOperationResult({
        success,
        message: success ? `${type} connection test successful` : `${type} connection test failed`,
        details: { type, timestamp: new Date().toISOString() }
      });
    } catch (error) {
      setOperationResult({
        success: false,
        message: `${type} connection test error`,
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      });
    } finally {
      setIsTesting(false);
    }
  }, [onTestConnection]);
  const updateConfig = useCallback((section: keyof SystemConfig, key: string, value: unknown) => {
    setConfig(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [key]: value
      }
    }));
  }, [setConfig]);

  const updateNestedConfig = useCallback((section: keyof SystemConfig, parentKey: string, key: string, value: unknown) => {
    setConfig(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [parentKey]: {
          ...(prev[section] as Record<string, unknown>)[parentKey] as Record<string, unknown>,
          [key]: value
        }
      }
    }));
  }, [setConfig]);

  const getEncryptionLevelColor = (level: string) => {
    switch (level) {
      case 'high': return 'text-green-600 bg-green-50';
      case 'standard': return 'text-yellow-600 bg-yellow-50';
      case 'basic': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">System Settings</h2>
          <p className="text-muted-foreground">
            Configure system preferences, security, and performance settings
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleReset} disabled={isResetting}>
            {isResetting ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Resetting...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Reset to Default
              </>
            )}
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Settings
              </>
            )}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="general" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="database">Database</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                General Settings
              </CardTitle>
              <CardDescription>
                Basic system configuration and preferences
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label htmlFor="system-name">System Name</Label>
                  <Input
                    id="system-name"
                    value={config.general.systemName}
                    onChange={(e) => updateConfig('general', 'systemName', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="timezone">Timezone</Label>
                  <Select
                    value={config.general.timezone}
                    onValueChange={(value) => updateConfig('general', 'timezone', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Asia/Shanghai">Asia/Shanghai</SelectItem>
                      <SelectItem value="UTC">UTC</SelectItem>
                      <SelectItem value="America/New_York">America/New_York</SelectItem>
                      <SelectItem value="Europe/London">Europe/London</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="language">Language</Label>
                  <Select
                    value={config.general.language}
                    onValueChange={(value) => updateConfig('general', 'language', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="zh">中文</SelectItem>
                      <SelectItem value="es">Español</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="date-format">Date Format</Label>
                  <Select
                    value={config.general.dateFormat}
                    onValueChange={(value) => updateConfig('general', 'dateFormat', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
                      <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                      <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-medium">System Options</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="auto-save"
                      checked={config.general.autoSave}
                      onCheckedChange={(checked: boolean) => updateConfig('general', 'autoSave', checked)}
                    />
                    <Label htmlFor="auto-save">Auto-save changes</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="debug-mode"
                      checked={config.general.debugMode}
                      onCheckedChange={(checked: boolean) => updateConfig('general', 'debugMode', checked)}
                    />
                    <Label htmlFor="debug-mode">Debug mode</Label>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Security Settings
              </CardTitle>
              <CardDescription>
                Configure security policies and authentication settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label htmlFor="session-timeout">Session Timeout (minutes)</Label>
                  <Input
                    id="session-timeout"
                    type="number"
                    min="5"
                    max="480"
                    value={config.security.sessionTimeout}
                    onChange={(e) => updateConfig('security', 'sessionTimeout', parseInt(e.target.value))}
                  />
                </div>
                <div>
                  <Label htmlFor="max-login-attempts">Max Login Attempts</Label>
                  <Input
                    id="max-login-attempts"
                    type="number"
                    min="3"
                    max="10"
                    value={config.security.maxLoginAttempts}
                    onChange={(e) => updateConfig('security', 'maxLoginAttempts', parseInt(e.target.value))}
                  />
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-medium">Password Policy</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label htmlFor="min-password-length">Minimum Length</Label>
                    <Input
                      id="min-password-length"
                      type="number"
                      min="6"
                      max="20"
                      value={config.security.passwordPolicy.minLength}
                      onChange={(e) => updateNestedConfig('security', 'passwordPolicy', 'minLength', parseInt(e.target.value))}
                    />
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="require-uppercase"
                        checked={config.security.passwordPolicy.requireUppercase}
                        onCheckedChange={(checked: boolean) => updateNestedConfig('security', 'passwordPolicy', 'requireUppercase', checked)}
                      />
                      <Label htmlFor="require-uppercase">Require uppercase letters</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="require-lowercase"
                        checked={config.security.passwordPolicy.requireLowercase}
                        onCheckedChange={(checked: boolean) => updateNestedConfig('security', 'passwordPolicy', 'requireLowercase', checked)}
                      />
                      <Label htmlFor="require-lowercase">Require lowercase letters</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="require-numbers"
                        checked={config.security.passwordPolicy.requireNumbers}
                        onCheckedChange={(checked: boolean) => updateNestedConfig('security', 'passwordPolicy', 'requireNumbers', checked)}
                      />
                      <Label htmlFor="require-numbers">Require numbers</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="require-special"
                        checked={config.security.passwordPolicy.requireSpecialChars}
                        onCheckedChange={(checked: boolean) => updateNestedConfig('security', 'passwordPolicy', 'requireSpecialChars', checked)}
                      />
                      <Label htmlFor="require-special">Require special characters</Label>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-medium">Advanced Security</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="two-factor"
                      checked={config.security.twoFactorAuth}
                      onCheckedChange={(checked: boolean) => updateConfig('security', 'twoFactorAuth', checked)}
                    />
                    <Label htmlFor="two-factor">Enable two-factor authentication</Label>
                  </div>
                  <div>
                    <Label htmlFor="encryption-level">Encryption Level</Label>
                    <Select
                      value={config.security.encryptionLevel}
                      onValueChange={(value: string) => updateConfig('security', 'encryptionLevel', value as any)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="basic">Basic</SelectItem>
                        <SelectItem value="standard">Standard</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Performance Settings
              </CardTitle>
              <CardDescription>
                Configure system performance and resource management
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label htmlFor="max-concurrent">Max Concurrent Executions</Label>
                  <Input
                    id="max-concurrent"
                    type="number"
                    min="1"
                    max="20"
                    value={config.performance.maxConcurrentExecutions}
                    onChange={(e) => updateConfig('performance', 'maxConcurrentExecutions', parseInt(e.target.value))}
                  />
                </div>
                <div>
                  <Label htmlFor="execution-timeout">Execution Timeout (seconds)</Label>
                  <Input
                    id="execution-timeout"
                    type="number"
                    min="30"
                    max="3600"
                    value={config.performance.executionTimeout}
                    onChange={(e) => updateConfig('performance', 'executionTimeout', parseInt(e.target.value))}
                  />
                </div>
                <div>
                  <Label htmlFor="retry-attempts">Retry Attempts</Label>
                  <Input
                    id="retry-attempts"
                    type="number"
                    min="0"
                    max="10"
                    value={config.performance.retryAttempts}
                    onChange={(e) => updateConfig('performance', 'retryAttempts', parseInt(e.target.value))}
                  />
                </div>
                <div>
                  <Label htmlFor="retry-delay">Retry Delay (ms)</Label>
                  <Input
                    id="retry-delay"
                    type="number"
                    min="100"
                    max="10000"
                    value={config.performance.retryDelay}
                    onChange={(e) => updateConfig('performance', 'retryDelay', parseInt(e.target.value))}
                  />
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-medium">Caching & Logging</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="cache-enabled"
                      checked={config.performance.cacheEnabled}
                      onCheckedChange={(checked: boolean) => updateConfig('performance', 'cacheEnabled', checked)}
                    />
                    <Label htmlFor="cache-enabled">Enable caching</Label>
                  </div>
                  <div>
                    <Label htmlFor="cache-size">Cache Size (MB)</Label>
                    <Input
                      id="cache-size"
                      type="number"
                      min="10"
                      max="1000"
                      value={config.performance.cacheSize}
                      onChange={(e) => updateConfig('performance', 'cacheSize', parseInt(e.target.value))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="log-level">Log Level</Label>
                    <Select
                      value={config.performance.logLevel}
                      onValueChange={(value: string) => updateConfig('performance', 'logLevel', value as any)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="debug">Debug</SelectItem>
                        <SelectItem value="info">Info</SelectItem>
                        <SelectItem value="warn">Warning</SelectItem>
                        <SelectItem value="error">Error</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-medium">Maintenance</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="auto-cleanup"
                      checked={config.performance.autoCleanup}
                      onCheckedChange={(checked: boolean) => updateConfig('performance', 'autoCleanup', checked)}
                    />
                    <Label htmlFor="auto-cleanup">Auto cleanup old data</Label>
                  </div>
                  <div>
                    <Label htmlFor="cleanup-interval">Cleanup Interval (hours)</Label>
                    <Input
                      id="cleanup-interval"
                      type="number"
                      min="1"
                      max="168"
                      value={config.performance.cleanupInterval}
                      onChange={(e) => updateConfig('performance', 'cleanupInterval', parseInt(e.target.value))}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="database" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Database Settings
              </CardTitle>
              <CardDescription>
                Configure database connection and maintenance settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label htmlFor="connection-pool">Connection Pool Size</Label>
                  <Input
                    id="connection-pool"
                    type="number"
                    min="5"
                    max="50"
                    value={config.database.connectionPool}
                    onChange={(e) => updateConfig('database', 'connectionPool', parseInt(e.target.value))}
                  />
                </div>
                <div>
                  <Label htmlFor="query-timeout">Query Timeout (seconds)</Label>
                  <Input
                    id="query-timeout"
                    type="number"
                    min="5"
                    max="300"
                    value={config.database.queryTimeout}
                    onChange={(e) => updateConfig('database', 'queryTimeout', parseInt(e.target.value))}
                  />
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-medium">Backup Settings</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="backup-enabled"
                      checked={config.database.backupEnabled}
                      onCheckedChange={(checked: boolean) => updateConfig('database', 'backupEnabled', checked)}
                    />
                    <Label htmlFor="backup-enabled">Enable automatic backups</Label>
                  </div>
                  <div>
                    <Label htmlFor="backup-frequency">Backup Frequency</Label>
                    <Select
                      value={config.database.backupFrequency}
                      onValueChange={(value: string) => updateConfig('database', 'backupFrequency', value as any)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="backup-retention">Retention (days)</Label>
                    <Input
                      id="backup-retention"
                      type="number"
                      min="1"
                      max="365"
                      value={config.database.backupRetention}
                      onChange={(e) => updateConfig('database', 'backupRetention', parseInt(e.target.value))}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-medium">Optimization</h4>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="auto-optimize"
                    checked={config.database.autoOptimize}
                    onCheckedChange={(checked: boolean) => updateConfig('database', 'autoOptimize', checked)}
                  />
                  <Label htmlFor="auto-optimize">Auto-optimize database</Label>
                </div>
              </div>

              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => handleTestConnection('database')}
                  disabled={isTesting}
                >
                  {isTesting ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Testing...
                    </>
                  ) : (
                    <>
                      <Database className="h-4 w-4 mr-2" />
                      Test Connection
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Notification Settings
              </CardTitle>
              <CardDescription>
                Configure notification channels and preferences
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <h4 className="font-medium">Notification Channels</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="email-enabled"
                      checked={config.notifications.emailEnabled}
                      onCheckedChange={(checked: boolean) => updateConfig('notifications', 'emailEnabled', checked)}
                    />
                    <Label htmlFor="email-enabled">Email notifications</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="slack-enabled"
                      checked={config.notifications.slackEnabled}
                      onCheckedChange={(checked: boolean) => updateConfig('notifications', 'slackEnabled', checked)}
                    />
                    <Label htmlFor="slack-enabled">Slack notifications</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="webhook-enabled"
                      checked={config.notifications.webhookEnabled}
                      onCheckedChange={(checked: boolean) => updateConfig('notifications', 'webhookEnabled', checked)}
                    />
                    <Label htmlFor="webhook-enabled">Webhook notifications</Label>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-medium">Default Recipients</h4>
                <Textarea
                  value={config.notifications.defaultRecipients.join('\n')}
                  onChange={(e) => updateConfig('notifications', 'defaultRecipients', e.target.value.split('\n').filter((r) => r.trim()))}
                  placeholder="Enter email addresses (one per line)"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label htmlFor="alert-threshold">Alert Threshold</Label>
                  <Input
                    id="alert-threshold"
                    type="number"
                    min="1"
                    max="100"
                    value={config.notifications.alertThreshold}
                    onChange={(e) => updateConfig('notifications', 'alertThreshold', parseInt(e.target.value))}
                  />
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-medium">Quiet Hours</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="quiet-hours-enabled"
                      checked={config.notifications.quietHours.enabled}
                      onCheckedChange={(checked: boolean) => updateNestedConfig('notifications', 'quietHours', 'enabled', checked)}
                    />
                    <Label htmlFor="quiet-hours-enabled">Enable quiet hours</Label>
                  </div>
                  <div>
                    <Label htmlFor="quiet-start">Start Time</Label>
                    <Input
                      id="quiet-start"
                      type="time"
                      value={config.notifications.quietHours.start}
                      onChange={(e) => updateNestedConfig('notifications', 'quietHours', 'start', e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="quiet-end">End Time</Label>
                    <Input
                      id="quiet-end"
                      type="time"
                      value={config.notifications.quietHours.end}
                      onChange={(e) => updateNestedConfig('notifications', 'quietHours', 'end', e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Notification Rules</CardTitle>
              <CardDescription>Enable/disable specific event notifications</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                {(config.notifications.rules || []).map((r, idx) => (
                  <div key={idx} className="flex items-center justify-between">
                    <div className="text-sm">
                      <div className="font-medium">{r.eventType}</div>
                      <div className="text-muted-foreground">Channel: {r.channel}</div>
                    </div>
                    <div>
                      <input
                        type="checkbox"
                        className="h-4 w-4"
                        checked={!!r.enabled}
                        onChange={async (e) => {
                          const enabled = e.target.checked
                          const next = { ...config }
                          next.notifications.rules = (next.notifications.rules || []).map((x, i) => i === idx ? { ...x, enabled } : x)
                          setConfig(next)
                          try {
                            await fetch('/api/go/api/v1/notifications/rules', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ eventType: r.eventType, channel: r.channel, enabled }) })
                          } catch {}
                        }}
                      />
                    </div>
                  </div>
                ))}
                {(config.notifications.rules || []).length === 0 && (
                  <div className="text-sm text-muted-foreground">No rules yet.</div>
                )}
                <div>
                  <button
                    className="text-sm underline"
                    onClick={async () => {
                      try {
                        const r = await fetch('/api/go/api/v1/notifications/rules', { cache: 'no-store' })
                        if (!r.ok) return
                        const data = await r.json()
                        const items = Array.isArray(data.items) ? data.items : []
                        setConfig((prev) => ({ ...prev, notifications: { ...prev.notifications, rules: items.map((x: any) => ({ eventType: x.eventType || x.event_type, channel: (x.channel || 'inapp') as any, enabled: !!x.enabled })) } }))
                      } catch {}
                    }}
                  >
                    Refresh Rules
                  </button>
                </div>
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
                {Object.entries(operationResult.details as any).map(([key, value]: any) => (
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

export default SystemSettings; 
