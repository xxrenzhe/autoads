import React from 'react';
import {
  List,
  Datagrid,
  TextField,
  EditButton,
  DateField,
  TopToolbar,
  CreateButton,
  ExportButton,
  usePermissions,
} from 'react-admin';

/**
 * Configuration list actions
 */
const ConfigListActions: React.FC = () => {
  const { permissions } = usePermissions();
  const canCreate = permissions?.includes('write:config');

  return (
    <TopToolbar>
      {canCreate && <CreateButton />}
      <ExportButton />
    </TopToolbar>
  );
};

/**
 * Configuration list component
 */
export const ConfigList: React.FC = () => {
  const { permissions } = usePermissions();
  const canEdit = permissions?.includes('write:config');

  return (
    <List
      actions={<ConfigListActions />}
      perPage={25}
      sort={{ field: 'key', order: 'ASC' }}
    >
      <Datagrid>
        <TextField source="key" />
        <TextField source="value" />
        <TextField source="description" />
        <DateField source="updatedAt" showTime />
        <TextField source="updatedBy" />
        
        {/* Action buttons based on permissions */}
        {canEdit && <EditButton />}
      </Datagrid>
    </List>
  );
};