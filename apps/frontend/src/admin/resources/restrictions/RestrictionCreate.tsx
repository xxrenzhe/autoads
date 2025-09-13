import React, { useState, useEffect } from 'react';
import {
  Create,
  SimpleForm,
  TextInput,
  SelectInput,
  DateTimeInput,
  ReferenceInput,
  AutocompleteInput,
  useNotify,
  useRedirect,
  usePermissions,
  required,
} from 'react-admin';
import { useSearchParams } from 'react-router-dom';
import { Box, Typography, Alert, AlertTitle, FormControlLabel, Checkbox } from '@mui/material';
import { Block as BlockIcon } from '@mui/icons-material';

/**
 * Restriction type choices
 */
const restrictionTypeChoices = [
  { id: 'API_LIMIT', name: 'API限制 - 限制API调用频率' },
  { id: 'BATCH_LIMIT', name: '批量操作限制 - 限制批量操作数量' },
  { id: 'ACCOUNT_SUSPEND', name: '账户暂停 - 暂停账户所有功能' },
  { id: 'LOGIN_BLOCK', name: '登录阻止 - 阻止用户登录' },
  { id: 'FEATURE_ACCESS', name: '功能访问限制 - 限制特定功能使用' },
];

/**
 * Duration presets in hours
 */
const durationPresets = [
  { label: '1小时', value: 1 },
  { label: '6小时', value: 6 },
  { label: '12小时', value: 12 },
  { label: '24小时 (1天)', value: 24 },
  { label: '48小时 (2天)', value: 48 },
  { label: '72小时 (3天)', value: 72 },
  { label: '168小时 (7天)', value: 168 },
  { label: '720小时 (30天)', value: 720 },
];

/**
 * User Restriction Create Component
 */
export const RestrictionCreate = () => {
  const notify = useNotify();
  const redirect = useRedirect();
  const { permissions } = usePermissions();
  const [customDuration, setCustomDuration] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState(24);
  const [searchParams] = useSearchParams();
  const [defaultUserId, setDefaultUserId] = useState<string | undefined>();

  useEffect(() => {
    const userId = searchParams.get('userId');
    if (userId) => {
      setDefaultUserId(userId);
    }
  }, [searchParams]);

  const onSuccess = () => {
    notify('用户限制已创建', { type: 'success' });
    redirect('list', 'restrictions');
  };

  const onError = (error: any) => {
    notify(`创建失败: ${error.message}`, { type: 'error' });
  };

  const transform = (data: any) => {
    const transformed = { ...data };
    
    // Calculate expiresAt based on duration
    if (!customDuration && selectedPreset) => {
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + selectedPreset);
      transformed.expiresAt = expiresAt.toISOString();
    }
    
    return transformed;
  };

  return (
    <Create
      title="创建用户限制"
      mutationOptions={{ onSuccess, onError }}
      transform={transform}
    >
      <SimpleForm>
        <Box sx={{ p: 2, width: '100%' }}>
          <Typography variant="h6" gutterBottom>
            创建新的用户限制
          </Typography>

          <Alert severity="warning" sx={{ mb: 3 }}>
            <AlertTitle>警告</AlertTitle>
            用户限制将立即生效并影响用户体验。请谨慎操作，确保限制措施合理且有明确原因。
          </Alert>

          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mb: 2 }}>
            <ReferenceInput
              source="userId"
              reference="users"
              filter={{ status: 'ACTIVE' }}
              defaultValue={defaultUserId}
            >
              <AutocompleteInput
                optionText="email"
                label="选择用户 *"
                helperText="搜索并选择要限制的用户"
                disabled={!!defaultUserId}
                validate={[required()]}
              />
            </ReferenceInput>
            
            <SelectInput
              source="type"
              choices={restrictionTypeChoices}
              validate={[required()]}
              label="限制类型 *"
              helperText="选择要应用的限制类型"
            />
          </Box>

          <TextInput
            source="reason"
            validate={[required()]}
            label="限制原因 *"
            fullWidth
            multiline
            rows={3}
            helperText="详细说明限制的原因，这将记录在审计日志中"
          />

          <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
            限制时长
          </Typography>

          <Box sx={{ mb: 2 }}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={customDuration}
                  onChange={(e) => setCustomDuration(e.target.checked)}
                />
              }
              label="自定义过期时间"
            />
          </Box>

          {!customDuration ? (
            <Box>
              <Typography variant="body2" color="textSecondary" sx={{ mb: 1 }}>
                选择预设时长：
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
                {durationPresets.map((preset: any) => (
                  <FormControlLabel
                    key={preset.value}
                    control={
                      <Checkbox
                        checked={selectedPreset === preset.value}
                        onChange={() => setSelectedPreset(preset.value)}
                      />
                    }
                    label={preset.label}
                  />
                ))}
              </Box>
            </Box>
          ) : (
            <DateTimeInput
              source="expiresAt"
              validate={[required()]}
              label="过期时间 *"
              helperText="限制将在此时间后自动解除"
            />
          )}

          {!customDuration && (
            <Alert severity="info" sx={{ mb: 2 }}>
              限制将在 {selectedPreset} 小时后自动解除（约 {(selectedPreset / 24).toFixed(1)} 天）
            </Alert>
          )}

          <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
            限制效果说明
          </Typography>

          <Box sx={{ pl: 2 }}>
            <Typography variant="body2" paragraph>
              <strong>API限制：</strong>用户将无法调用API接口，返回403错误
            </Typography>
            <Typography variant="body2" paragraph>
              <strong>批量操作限制：</strong>用户无法执行批量操作，如批量检查链接
            </Typography>
            <Typography variant="body2" paragraph>
              <strong>账户暂停：</strong>用户账户被暂停，无法使用任何功能
            </Typography>
            <Typography variant="body2" paragraph>
              <strong>登录阻止：</strong>用户无法登录系统
            </Typography>
            <Typography variant="body2" paragraph>
              <strong>功能访问限制：</strong>用户无法访问特定功能
            </Typography>
          </Box>

          {permissions === 'SUPER_ADMIN' && (
            <Alert severity="error" sx={{ mt: 2 }}>
              <AlertTitle>超级管理员权限</AlertTitle>
              作为超级管理员，您可以创建任何类型的限制。请确保操作符合公司政策。
            </Alert>
          )}
        </Box>
      </SimpleForm>
    </Create>
  );
};