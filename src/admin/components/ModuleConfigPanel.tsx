import React, { useState } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  Typography,
  Switch,
  FormControlLabel,
  TextField,
  Button,
  Box,
  Divider,
  Alert,
  Tabs,
  Tab,
  Grid,
} from '@mui/material';
import { useNotify, useRefresh } from 'react-admin';
import { apiClient } from '../../shared/lib/api-client';

/**
 * Module configuration interface
 */
interface ModuleConfig {
  enabled: boolean;
  maxConcurrentTasks: number;
  rateLimitPerMinute: number;
  timeoutSeconds: number;
  retryAttempts: number;
  cacheEnabled: boolean;
  cacheTtlMinutes: number;
  debugMode: boolean;
  customSettings: Record<string, any>;
}

/**
 * Module configuration panel props
 */
interface ModuleConfigPanelProps {
  moduleName: string;
  config: ModuleConfig;
  onConfigChange: (config: ModuleConfig) => void;
}

/**
 * Individual module configuration panel
 */
const ModuleConfigPanel: React.FC<ModuleConfigPanelProps> = ({
  moduleName,
  config,
  onConfigChange,
}) => {
  const [localConfig, setLocalConfig] = useState<ModuleConfig>(config);
  const [saving, setSaving] = useState(false);
  const notify = useNotify();

  const handleConfigUpdate = (updates: Partial<ModuleConfig>) => {
    const newConfig = { ...localConfig, ...updates };
    setLocalConfig(newConfig);
    onConfigChange(newConfig);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiClient.put(`/admin/modules/${moduleName}/config`, localConfig);
      notify(`${moduleName} configuration saved successfully`, { type: 'success' });
    } catch (error) {
      notify(`Failed to save ${moduleName} configuration`, { type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader
        title={`${moduleName.charAt(0).toUpperCase() + moduleName.slice(1)} Configuration`}
        action={
          <FormControlLabel
            control={
              <Switch
                checked={localConfig.enabled}
                onChange={(e) => handleConfigUpdate({ enabled: e.target.checked })}
              />
            }
            label="Enabled"
          />
        }
      />
      
      <CardContent>
        <Grid container spacing={3}>
          {/* Performance Settings */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Typography variant="h6" gutterBottom>
              Performance Settings
            </Typography>
            
            <TextField
              label="Max Concurrent Tasks"
              type="number"
              value={localConfig.maxConcurrentTasks}
              onChange={(e) => handleConfigUpdate({ maxConcurrentTasks: parseInt(e.target.value) })}
              fullWidth
              margin="normal"
              disabled={!localConfig.enabled}
            />
            
            <TextField
              label="Rate Limit (per minute)"
              type="number"
              value={localConfig.rateLimitPerMinute}
              onChange={(e) => handleConfigUpdate({ rateLimitPerMinute: parseInt(e.target.value) })}
              fullWidth
              margin="normal"
              disabled={!localConfig.enabled}
            />
            
            <TextField
              label="Timeout (seconds)"
              type="number"
              value={localConfig.timeoutSeconds}
              onChange={(e) => handleConfigUpdate({ timeoutSeconds: parseInt(e.target.value) })}
              fullWidth
              margin="normal"
              disabled={!localConfig.enabled}
            />
            
            <TextField
              label="Retry Attempts"
              type="number"
              value={localConfig.retryAttempts}
              onChange={(e) => handleConfigUpdate({ retryAttempts: parseInt(e.target.value) })}
              fullWidth
              margin="normal"
              disabled={!localConfig.enabled}
            />
          </Grid>

          {/* Cache Settings */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Typography variant="h6" gutterBottom>
              Cache Settings
            </Typography>
            
            <FormControlLabel
              control={
                <Switch
                  checked={localConfig.cacheEnabled}
                  onChange={(e) => handleConfigUpdate({ cacheEnabled: e.target.checked })}
                  disabled={!localConfig.enabled}
                />
              }
              label="Cache Enabled"
            />
            
            <TextField
              label="Cache TTL (minutes)"
              type="number"
              value={localConfig.cacheTtlMinutes}
              onChange={(e) => handleConfigUpdate({ cacheTtlMinutes: parseInt(e.target.value) })}
              fullWidth
              margin="normal"
              disabled={!localConfig.enabled || !localConfig.cacheEnabled}
            />
            
            <FormControlLabel
              control={
                <Switch
                  checked={localConfig.debugMode}
                  onChange={(e) => handleConfigUpdate({ debugMode: e.target.checked })}
                  disabled={!localConfig.enabled}
                />
              }
              label="Debug Mode"
            />
          </Grid>
        </Grid>

        <Divider sx={{ my: 3 }} />

        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
          <Button
            variant="outlined"
            onClick={() => setLocalConfig(config)}
            disabled={saving}
          >
            Reset
          </Button>
          
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={saving || !localConfig.enabled}
          >
            {saving ? 'Saving...' : 'Save Configuration'}
          </Button>
        </Box>
      </CardContent>
    </Card>
  );
};

/**
 * Main business module configuration component
 */
export const BusinessModuleConfig: React.FC = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [configs, setConfigs] = useState<Record<string, ModuleConfig>>({
    siterank: {
      enabled: true,
      maxConcurrentTasks: 10,
      rateLimitPerMinute: 60,
      timeoutSeconds: 30,
      retryAttempts: 3,
      cacheEnabled: true,
      cacheTtlMinutes: 60,
      debugMode: false,
      customSettings: {},
    },
    batchopen: {
      enabled: true,
      maxConcurrentTasks: 5,
      rateLimitPerMinute: 30,
      timeoutSeconds: 120,
      retryAttempts: 2,
      cacheEnabled: false,
      cacheTtlMinutes: 0,
      debugMode: false,
      customSettings: {},
    },
    adscenter: {
      enabled: true,
      maxConcurrentTasks: 3,
      rateLimitPerMinute: 20,
      timeoutSeconds: 60,
      retryAttempts: 3,
      cacheEnabled: true,
      cacheTtlMinutes: 30,
      debugMode: false,
      customSettings: {},
    },
  });

  const modules = ['siterank', 'batchopen', 'adscenter'];

  const handleConfigChange = (moduleName: string, config: ModuleConfig) => {
    setConfigs(prev => ({
      ...prev,
      [moduleName]: config,
    }));
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Business Module Configuration
      </Typography>
      
      <Alert severity="info" sx={{ mb: 3 }}>
        Configure settings for each business module. Changes take effect immediately.
      </Alert>

      <Tabs
        value={activeTab}
        onChange={(_, newValue) => setActiveTab(newValue)}
        sx={{ mb: 3 }}
      >
        {modules.map((module, index) => (
          <Tab
            key={module}
            label={module.charAt(0).toUpperCase() + module.slice(1)}
            id={`module-tab-${index}`}
          />
        ))}
      </Tabs>

      {modules.map((module, index) => (
        <Box
          key={module}
          role="tabpanel"
          hidden={activeTab !== index}
          id={`module-tabpanel-${index}`}
        >
          {activeTab === index && (
            <ModuleConfigPanel
              moduleName={module}
              config={configs[module]}
              onConfigChange={(config) => handleConfigChange(module, config)}
            />
          )}
        </Box>
      ))}
    </Box>
  );
};