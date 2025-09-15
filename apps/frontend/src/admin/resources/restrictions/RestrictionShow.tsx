import React from 'react';
import {
  Show,
  SimpleShowLayout,
  TextField,
  DateField,
  BooleanField,
  ReferenceField,
  Labeled,
  useRecordContext,
  usePermissions,
} from 'react-admin';
import { Box, Typography, Chip, Alert, AlertTitle, Divider } from '@mui/material';
import { Block as BlockIcon, Check as CheckIcon, AccessTime as TimeIcon } from '@mui/icons-material';

/**
 * Restriction title component
 */
const RestrictionTitle = () => {
  const record = useRecordContext();
  if (!record) return null as any;
  return (
    <span>
      用户限制详情: {record.user?.email} - {record.type}
    </span>
  );
};

/**
 * Restriction type chip
 */
const RestrictionTypeChip = ({ type, isActive }: { type: string; isActive: boolean }) => {
  const colors: Record<string, 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success'> = {
    API_LIMIT: 'error',
    BATCH_LIMIT: 'info',
    ACCOUNT_SUSPEND: 'error',
    LOGIN_BLOCK: 'error',
    FEATURE_ACCESS: 'info',
  };

  const labels: Record<string, string> = {
    API_LIMIT: 'API限制',
    BATCH_LIMIT: '批量限制',
    ACCOUNT_SUSPEND: '账户暂停',
    LOGIN_BLOCK: '登录阻止',
    FEATURE_ACCESS: '功能限制',
  };

  return (
    <Chip
      icon={isActive ? <BlockIcon /> : <CheckIcon />}
      label={labels[type] || type}
      color={colors[type] || 'default'}
      size="medium"
      variant={isActive ? 'filled' : 'outlined'}
    />
  );
};

/**
 * Status alert component
 */
const RestrictionStatusAlert = () => {
  const record = useRecordContext();
  if (!record) return null as any;

  const now = new Date();
  const expiresAt = new Date(record.expiresAt);
  const isExpired = expiresAt < now;

  if (!record.isActive) {
    return (
      <Alert severity="success">
        <AlertTitle>限制已解除</AlertTitle>
        此限制已被手动解除，用户不再受影响。
      </Alert>
    );
  }

  if (isExpired) {
    return (
      <Alert severity="warning">
        <AlertTitle>限制已过期</AlertTitle>
        此限制已于 {expiresAt.toLocaleString('zh-CN')} 过期，但仍标记为活跃。
      </Alert>
    );
  }

  const timeRemaining = expiresAt.getTime() - now.getTime();
  const hoursRemaining = Math.floor(timeRemaining / (1000 * 60 * 60));
  const daysRemaining = Math.floor(hoursRemaining / 24);

  return (
    <Alert severity={hoursRemaining < 24 ? 'error' : 'info'}>
      <AlertTitle>限制生效中</AlertTitle>
      限制将在 {daysRemaining > 0 ? `${daysRemaining} 天 ` : ''}{hoursRemaining % 24} 小时后自动解除。
    </Alert>
  );
};

/**
 * User Restriction Show Component
 */
export const RestrictionShow = () => {
  const { permissions } = usePermissions();

  return (
    <Show
      title={<RestrictionTitle />}
      actions={false}
    >
      <SimpleShowLayout>
        <Box sx={{ p: 2 }}>
          <RestrictionStatusAlert />
          
          <Divider sx={{ my: 3 }} />
          
          <Typography variant="h6" gutterBottom>
            基本信息
          </Typography>
          
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3, mb: 3 }}>
            <Labeled label="限制ID">
              <TextField source="id" />
            </Labeled>
            
            <Labeled label="用户">
              <ReferenceField source="userId" reference="users" link="show">
                <TextField source="email" />
              </ReferenceField>
            </Labeled>
            
            <Labeled label="限制类型">
              <Box>
                <RestrictionTypeChip 
                  type={(useRecordContext()?.type as string) || ''} 
                  isActive={useRecordContext()?.isActive || false} 
                />
              </Box>
            </Labeled>
            
            <Labeled label="当前状态">
              <BooleanField
                source="isActive"
                TrueIcon={CheckIcon}
                FalseIcon={BlockIcon}
                valueLabelTrue="生效中"
                valueLabelFalse="已解除"
              />
            </Labeled>
          </Box>

          <Labeled label="限制原因" sx={{ mb: 3 }}>
            <TextField source="reason" />
          </Labeled>

          <Typography variant="h6" gutterBottom>
            时间信息
          </Typography>
          
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3, mb: 3 }}>
            <Labeled label="创建时间">
              <DateField
                source="createdAt"
                showTime
                locales="zh-CN"
              />
            </Labeled>
            
            <Labeled label="过期时间">
              <DateField
                source="expiresAt"
                showTime
                locales="zh-CN"
              />
            </Labeled>
            
            <Labeled label="最后更新">
              <DateField
                source="updatedAt"
                showTime
                locales="zh-CN"
              />
            </Labeled>
          </Box>

          <Typography variant="h6" gutterBottom>
            影响说明
          </Typography>

          <RestrictionDescription />
        </Box>

          {permissions === 'ADMIN' && (
            <>
              <Divider sx={{ my: 3 }} />
              <Alert severity="info">
                <AlertTitle>管理员信息</AlertTitle>
                此限制由管理员创建，可通过编辑功能修改或解除。
              </Alert>
            </>
          )}
      </SimpleShowLayout>
    </Show>
  );
};

function RestrictionDescription() {
  const record = useRecordContext();
  if (!record) return null as any;
  
  const descriptions: Record<string, string> = {
    API_LIMIT: '用户将无法调用任何API接口，所有API请求将返回403 Forbidden错误。',
    BATCH_LIMIT: '用户无法执行批量操作，包括批量链接检查、批量域名分析等功能。',
    ACCOUNT_SUSPEND: '用户账户被完全暂停，无法登录系统或使用任何功能。',
    LOGIN_BLOCK: '用户无法登录系统，但其他功能（如API）可能仍可使用，取决于具体配置。',
    FEATURE_ACCESS: '用户将无法访问特定的系统功能，具体取决于限制配置。',
  };

  return (
    <Typography variant="body2" color="textSecondary">
      {descriptions[record.type] || '未知限制类型'}
    </Typography>
  );
}
