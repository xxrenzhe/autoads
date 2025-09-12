import React from 'react';
import {
  List,
  Datagrid,
  TextField,
  NumberField,
  DateField,
  SelectField,
  ReferenceField,
  BooleanField,
  useTranslate,
} from 'react-admin';

const statusChoices = [
  { id: 'PENDING', name: '待处理' },
  { id: 'COMPLETED', name: '已完成' },
  { id: 'FAILED', name: '失败' },
  { id: 'REFUNDED', name: '已退款' },
];

export const TokenPurchaseList: React.FC = () => {
  const translate = useTranslate();

  return (
    <List>
      <Datagrid rowClick="edit">
        <ReferenceField 
          source="userId" 
          reference="users" 
          label="用户"
          link="show"
        >
          <TextField source="email" />
        </ReferenceField>
        <NumberField 
          source="tokens" 
          label="Token数量"
          options={{ style: 'decimal' }}
        />
        <NumberField 
          source="amount" 
          label="金额"
          options={{ style: 'currency', currency: 'USD' }}
        />
        <TextField source="currency" label="币种" />
        <SelectField 
          source="status" 
          choices={statusChoices}
          label="状态"
        />
        <TextField source="provider" label="支付渠道" />
        <DateField 
          source="createdAt" 
          label="创建时间"
          showTime
          locales="zh-CN"
        />
        <DateField 
          source="updatedAt" 
          label="更新时间"
          showTime
          locales="zh-CN"
        />
      </Datagrid>
    </List>
  );
};