import React from 'react';
import {
  Edit,
  SimpleForm,
  TextInput,
  SelectInput,
  NumberInput,
  BooleanInput,
  required,
  usePermissions,
  SaveButton,
  Toolbar,
} from 'react-admin';
import { Box, Typography, Divider } from '@mui/material';

/**
 * Configuration type choices
 */
const typeChoices = [
  { id: 'string', name: 'String' },
  { id: 'number', name: 'Number' },
  { id: 'boolean', name: 'Boolean' },
  { id: 'json', name: 'JSON' },
];

/**
 * Configuration category choices
 */
const categoryChoices = [
  { id: 'auth', name: 'Authentication' },
  { id: 'database', name: 'Database' },
  { id: 'payment', name: 'Payment' },
  { id: 'email', name: 'Email' },
  { id: 'security', name: 'Security' },
  { id: 'performance', name: 'Performance' },
];

/**
 * Custom toolbar
 */
const ConfigEditToolbar: React.FC = () => (
  <Toolbar>
    <SaveButton />
  </Toolbar>
);

/**
 * Dynamic input field based on configuration type
 */
const DynamicInputField: React.FC<{ type: string }> = ({ type }) => {
  switch (type) => {
    case 'number':
      return <NumberInput source="value" fullWidth />;
    case 'boolean':
      return <BooleanInput source="value" />;
    case 'json':
      return (
        <TextInput
          source="value"
          multiline
          rows={4}
          helperText="Enter valid JSON"
          fullWidth
        />
      );
    default:
      return <TextInput source="value" fullWidth />;
  }
};

/**
 * Configuration edit form
 */
export const ConfigEdit: React.FC = () => {
  const { permissions } = usePermissions();
  const canEditSensitive = permissions?.includes('write:config:sensitive');

  return (
    <Edit>
      <SimpleForm toolbar={<ConfigEditToolbar />}>
        <Box sx={{ width: '100%', maxWidth: 800 }}>
          {/* Basic Information */}
          <Typography variant="h6" gutterBottom>
            Configuration Setting
          </Typography>
          
          <TextInput
            source="key"
            validate={[required()]}
            disabled
            fullWidth
            helperText="Configuration keys cannot be changed"
          />
          
          <TextInput
            source="description"
            multiline
            rows={2}
            fullWidth
          />
          
          <SelectInput
            source="type"
            choices={typeChoices}
            validate={[required()]}
            disabled
            fullWidth
          />
          
          <SelectInput
            source="category"
            choices={categoryChoices}
            validate={[required()]}
            fullWidth
          />

          <BooleanInput
            source="isSensitive"
            label="Sensitive Information"
            disabled={!canEditSensitive}
          />

          <Divider sx={{ my: 2 }} />

          {/* Value */}
          <Typography variant="h6" gutterBottom>
            Value
          </Typography>
          
          <DynamicInputField type="string" /> {/* This will be replaced based on the actual type */}

          <Divider sx={{ my: 2 }} />

          {/* Metadata */}
          <Typography variant="h6" gutterBottom>
            Metadata
          </Typography>
          
          <TextInput
            source="updatedBy"
            disabled
            fullWidth
          />
          
          <TextInput
            source="updatedAt"
            disabled
            fullWidth
          />
        </Box>
      </SimpleForm>
    </Edit>
  );
};