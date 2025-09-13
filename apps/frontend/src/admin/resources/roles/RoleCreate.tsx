import React from 'react';
import {
  Create,
  SimpleForm,
  TextInput,
  SelectInput,
  ArrayInput,
  SimpleFormIterator,
  BooleanInput,
  required,
} from 'react-admin';
import { Box, Typography } from '@mui/material';

const permissionCategories = [
  {
    category: '用户管理',
    permissions: [
      { id: 'users:read', name: '查看用户' },
      { id: 'users:create', name: '创建用户' },
      { id: 'users:edit', name: '编辑用户' },
      { id: 'users:delete', name: '删除用户' },
    ],
  },
  {
    category: '角色管理',
    permissions: [
      { id: 'roles:read', name: '查看角色' },
      { id: 'roles:create', name: '创建角色' },
      { id: 'roles:edit', name: '编辑角色' },
      { id: 'roles:delete', name: '删除角色' },
    ],
  },
  {
    category: '订阅管理',
    permissions: [
      { id: 'subscriptions:read', name: '查看订阅' },
      { id: 'subscriptions:create', name: '创建订阅' },
      { id: 'subscriptions:edit', name: '编辑订阅' },
      { id: 'subscriptions:delete', name: '删除订阅' },
    ],
  },
  {
    category: '套餐管理',
    permissions: [
      { id: 'plans:read', name: '查看套餐' },
      { id: 'plans:create', name: '创建套餐' },
      { id: 'plans:edit', name: '编辑套餐' },
      { id: 'plans:delete', name: '删除套餐' },
    ],
  },
  {
    category: '系统配置',
    permissions: [
      { id: 'config:read', name: '查看配置' },
      { id: 'config:edit', name: '编辑配置' },
      { id: 'env:manage', name: '管理环境变量' },
    ],
  },
  {
    category: '支付管理',
    permissions: [
      { id: 'payments:read', name: '查看支付' },
      { id: 'payments:manage', name: '管理支付' },
    ],
  },
  {
    category: '通知管理',
    permissions: [
      { id: 'notifications:read', name: '查看通知' },
      { id: 'notifications:manage', name: '管理通知' },
    ],
  },
  {
    category: 'API管理',
    permissions: [
      { id: 'api:read', name: '查看API统计' },
    ],
  },
  {
    category: '业务功能',
    permissions: [
      { id: 'siterank:access', name: '使用SiteRank' },
      { id: 'batchopen:access', name: '使用BatchOpen' },
      { id: 'adscenter:access', name: '使用ChangeLink' },
    ],
  },
];

export const RoleCreate: React.FC = () => {
  return (
    <Create title="创建角色">
      <SimpleForm>
        <Box sx={{ width: '100%', maxWidth: 800 }}>
          <TextInput
            source="name"
            label="角色名称"
            validate={[required()]}
            fullWidth
          />
          
          <TextInput
            source="description"
            label="角色描述"
            multiline
            rows={3}
            fullWidth
          />
          
          <BooleanInput
            source="isActive"
            label="是否激活"
            defaultValue={true}
          />
          
          <Typography variant="h6" sx={{ mt: 2, mb: 1 }}>
            权限配置
          </Typography>
          
          {permissionCategories.map((category: any) => (
            <Box key={category.category} sx={{ mb: 2 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1 }}>
                {category.category}
              </Typography>
              <ArrayInput
                source={`permissions.${category.category.toLowerCase()}`}
                label={false}
              >
                <SimpleFormIterator
                  getItemLabel={(item: number) => {
                    const perm = category.permissions.find((p: any) => p.id === String(item));
                    return perm ? perm.name : String(item);
                  }}
                >
                  <SelectInput
                    choices={category.permissions}
                    optionText="name"
                    optionValue="id"
                    validate={[required()]}
                    fullWidth
                  />
                </SimpleFormIterator>
              </ArrayInput>
            </Box>
          ))}
        </Box>
      </SimpleForm>
    </Create>
  );
};