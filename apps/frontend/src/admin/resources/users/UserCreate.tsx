import React from 'react';
import {
  Create,
  SimpleForm,
  TextInput,
  SelectInput,
  BooleanInput,
  PasswordInput,
  ArrayInput,
  SimpleFormIterator,
  required,
  email,
  minLength,
  usePermissions,
} from 'react-admin';
import { Box, Typography, Divider } from '@mui/material';

/**
 * Role choices for selection
 */
const roleChoices = [
  { id: 'USER', name: 'User' },
  { id: 'ADMIN', name: 'Admin' },
  // SUPER_ADMIN removed in unified role model
];

/**
 * Permission choices for selection
 */
const permissionChoices = [
  { id: 'users:read', name: 'View Users' },
  { id: 'users:create', name: 'Create Users' },
  { id: 'users:edit', name: 'Edit Users' },
  { id: 'users:delete', name: 'Delete Users' },
  { id: 'admin:access', name: 'Admin Access' },
  { id: 'siterank:access', name: 'SiteRank Access' },
  { id: 'batchopen:access', name: 'BatchOpen Access' },
  { id: 'adscenter:access', name: 'AdsCenter Access' },
];

/**
 * User creation form component
 */
/**
 * Note: Since we use Google OAuth, user creation happens automatically
 * on first login. This form is for pre-creating users if needed.
 */
export const UserCreate: React.FC = () => {
  const { permissions } = usePermissions();
  const canAssignRole = permissions?.includes('write:users');

  return (
    <Create>
      <SimpleForm>
        <Box sx={{ width: '100%', maxWidth: 600 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Note: Users are typically created automatically when they first sign in with Google.
            This form allows pre-creating user accounts.
          </Typography>
          
          {/* Basic Information */}
          <Typography variant="h6" gutterBottom>
            Basic Information
          </Typography>
          
          <TextInput
            source="name"
            validate={[required()]}
            fullWidth
          />
          
          <TextInput
            source="email"
            type="email"
            validate={[required(), email()]}
            fullWidth
          />
          
          <SelectInput
            source="status"
            choices={[
              { id: 'ACTIVE', name: 'Active' },
              { id: 'INACTIVE', name: 'Inactive' },
            ]}
            validate={[required()]}
            defaultValue="ACTIVE"
            fullWidth
          />

          <BooleanInput
            source="isActive"
            label="Active User"
            defaultValue={true}
          />

          <Divider sx={{ my: 2 }} />

          {/* User Settings */}
          <Typography variant="h6" gutterBottom>
            User Settings
          </Typography>
          
          <TextInput
            source="tokenBalance"
            type="number"
            label="Initial Token Balance"
            defaultValue={100}
            fullWidth
          />

          {canAssignRole && (
            <SelectInput
              source="role"
              choices={roleChoices}
              validate={[required()]}
              defaultValue="USER"
              fullWidth
            />
          )}
        </Box>
      </SimpleForm>
    </Create>
  );
};
