import React from 'react';
import {
  List,
  Datagrid,
  TextField,
  NumberField,
  DateField,
  BooleanField,
  EditButton,
  ShowButton,
  useRefresh,
  useNotify,
  Button,
  ReferenceField,
  SelectField,
  Edit,
  SimpleForm,
  TextInput,
  SelectInput,
  NumberInput,
  Create,
  Show,
  SimpleShowLayout,
  required,
} from 'react-admin';
import {
  PlayArrow as Play,
  Pause,
  Stop,
  Refresh,
  TrendingUp,
} from '@mui/icons-material';

const statusChoices = [
  { id: 'pending', name: '未启动' },
  { id: 'running', name: '运行中' },
  { id: 'terminated', name: '已终止' },
];

const countryChoices = [
  { id: 'US', name: '美国' },
  { id: 'CN', name: '中国' },
  { id: 'UK', name: '英国' },
  { id: 'JP', name: '日本' },
];

const timeWindowChoices = [
  { id: '00:00-24:00', name: '全天 (00:00-24:00)' },
  { id: '06:00-24:00', name: '日间 (06:00-24:00)' },
];

export const AutoClickTaskList = () => {
  const refresh = useRefresh();
  const notify = useNotify();

  const handleAction = async (id: string, action: string) => {
    try {
      const response = await fetch(`/api/autoclick/tasks/${id}/${action}`, {
        method: 'POST',
      });
      
      if (response.ok) {
        notify(`任务${action === 'start' ? '启动' : action === 'terminate' ? '终止' : '暂停'}成功`, { type: 'success' });
        refresh();
      } else {
        const error = await response.json();
        notify(error.error || '操作失败', { type: 'error' });
      }
    } catch (error) {
      notify('操作失败', { type: 'error' });
    }
  };

  const ActionButtons = ({ record }: any) => (
    <div style={{ display: 'flex', gap: '5px' }}>
      {record?.status === 'pending' && (
        <Button
          size="small"
          color="primary"
          onClick={() => handleAction(record.id, 'start')}
          title="启动任务"
        >
          <Play />
        </Button>
      )}
      {record?.status === 'running' && (
        <Button
          size="small"
          color="error"
          onClick={() => handleAction(record.id, 'terminate')}
          title="终止任务"
        >
          <Stop />
        </Button>
      )}
      <Button
        size="small"
        onClick={() => handleAction(record.id, 'refresh')}
        title="刷新状态"
      >
        <Refresh />
      </Button>
    </div>
  );

  return (
    <List
      title="自动化点击任务管理"
      exporter={false}
      filters={[
        <SelectInput key="status" source="status" choices={statusChoices} label="任务状态" />,
        <SelectInput key="country" source="country" choices={countryChoices} label="国家" />,
        <SelectInput key="timeWindow" source="timeWindow" choices={timeWindowChoices} label="时间段" />,
      ]}
    >
      <Datagrid rowClick="show">
        <TextField source="id" />
        <ReferenceField source="userId" reference="users">
          <TextField source="email" />
        </ReferenceField>
        <TextField source="offerUrl" />
        <SelectField source="country" choices={countryChoices} />
        <SelectField source="timeWindow" choices={timeWindowChoices} />
        <NumberField source="dailyClicks" />
        <SelectField source="status" choices={statusChoices} />
        <DateField source="createdAt" showTime />
        <DateField source="updatedAt" showTime />
        <ActionButtons />
        <EditButton />
        <ShowButton />
      </Datagrid>
    </List>
  );
};

export const AutoClickTaskEdit = () => (
  <Edit title="编辑自动化点击任务">
    <SimpleForm>
      <TextInput source="offerUrl" label="目标URL" validate={required()} />
      <SelectInput source="country" choices={countryChoices} label="国家" validate={required()} />
      <SelectInput source="timeWindow" choices={timeWindowChoices} label="时间段" validate={required()} />
      <NumberInput source="dailyClicks" label="每日点击" validate={required()} min={1} max={10000} />
      <TextInput source="referer" label="Referer" validate={required()} />
      <SelectInput source="status" choices={statusChoices} label="状态" validate={required()} />
    </SimpleForm>
  </Edit>
);

export const AutoClickTaskShow = () => (
  <Show title="自动化点击任务详情">
    <SimpleShowLayout>
      <TextField source="id" label="ID" />
      <ReferenceField source="userId" reference="users" label="用户">
        <TextField source="email" />
      </ReferenceField>
      <TextField source="offerUrl" label="目标URL" />
      <SelectField source="country" choices={countryChoices} label="国家" />
      <SelectField source="timeWindow" choices={timeWindowChoices} label="时间段" />
      <NumberField source="dailyClicks" label="每日点击" />
      <TextField source="referer" label="Referer" />
      <SelectField source="status" choices={statusChoices} label="状态" />
      <DateField source="createdAt" label="创建时间" showTime />
      <DateField source="updatedAt" label="更新时间" showTime />
    </SimpleShowLayout>
  </Show>
);

export const AutoClickTaskCreate = () => (
  <Create title="创建自动化点击任务">
    <SimpleForm>
      <TextInput source="offerUrl" validate={required()} />
      <SelectInput source="country" choices={countryChoices} validate={required()} />
      <SelectInput source="timeWindow" choices={timeWindowChoices} validate={required()} />
      <NumberInput source="dailyClicks" validate={required()} min={1} max={10000} />
      <TextInput source="referer" defaultValue="https://google.com" validate={required()} />
    </SimpleForm>
  </Create>
);
