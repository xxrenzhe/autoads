import React from 'react';
import {
  Edit,
  SimpleForm,
  TextInput,
  NumberInput,
  SelectInput,
  BooleanInput,
  ArrayInput,
  SimpleFormIterator,
  required,
  useRecordContext,
} from 'react-admin';
import { Box, Typography, Divider } from '@mui/material';

const intervalChoices = [
  { id: 'MONTH', name: '月付' },
  { id: 'YEAR', name: '年付' },
];

const billingPeriodChoices = [
  { id: 'MONTHLY', name: '按月计费' },
  { id: 'YEARLY', name: '按年计费' },
];

const featureChoices = [
  { id: 'siterank', name: '网站排名查询' },
  { id: 'batchopen', name: '批量打开URL' },
  { id: 'adscenter', name: '自动化广告' },
  { id: 'api_access', name: 'API访问' },
  { id: 'priority_support', name: '优先支持' },
  { id: 'custom_domain', name: '自定义域名' },
  { id: 'white_label', name: '白标服务' },
  { id: 'advanced_analytics', name: '高级分析' },
];

const PlanFeaturesEdit: React.FC = () => {
  const record = useRecordContext();
  
  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        功能配置
      </Typography>
      
      <ArrayInput 
        source="features" 
        label="包含功能"
        helperText="选择此套餐包含的功能"
      >
        <SimpleFormIterator>
          <SelectInput
            choices={featureChoices}
            optionText="name"
            optionValue="id"
            validate={[required()]}
            fullWidth
          />
        </SimpleFormIterator>
      </ArrayInput>
      
      <Divider sx={{ my: 2 }} />
      
      <Typography variant="h6" gutterBottom>
        功能限制配置
      </Typography>
      
      <TextInput
        source="limits.siterank.dailyQueries"
        label="SiteRank每日查询次数"
        type="number"
        defaultValue={0}
        fullWidth
      />
      
      <TextInput
        source="limits.batchopen.dailyUrls"
        label="BatchOpen每日URL数量"
        type="number"
        defaultValue={0}
        fullWidth
      />
      
      <TextInput
        source="limits.adscenter.maxCampaigns"
        label="AdsCenter最大活动数"
        type="number"
        defaultValue={0}
        fullWidth
      />
      
      <TextInput
        source="limits.api.rateLimit"
        label="API调用限制(次/分钟)"
        type="number"
        defaultValue={60}
        fullWidth
      />
    </Box>
  );
};

export const PlanEdit: React.FC = () => {
  return (
    <Edit title="编辑套餐">
      <SimpleForm>
        <Box sx={{ width: '100%', maxWidth: 800 }}>
          {/* 基本信息 */}
          <Typography variant="h6" gutterBottom>
            基本信息
          </Typography>
          
          <TextInput
            source="name"
            label="套餐名称"
            validate={[required()]}
            fullWidth
          />
          
          <TextInput
            source="description"
            label="套餐描述"
            multiline
            rows={3}
            fullWidth
          />
          
          <NumberInput
            source="price"
            label="价格"
            validate={[required()]}
            min={0}
            step={0.01}
            fullWidth
          />
          
          <SelectInput
            source="currency"
            choices={[
              { id: 'USD', name: '美元' },
              { id: 'CNY', name: '人民币' },
            ]}
            defaultValue="USD"
            validate={[required()]}
            fullWidth
          />
          
          <SelectInput
            source="interval"
            choices={intervalChoices}
            validate={[required()]}
            fullWidth
          />
          
          <SelectInput
            source="billingPeriod"
            choices={billingPeriodChoices}
            validate={[required()]}
            fullWidth
          />
          
          <NumberInput
            source="tokenQuota"
            label="Token配额"
            validate={[required()]}
            min={0}
            helperText="每月包含的Token数量"
            fullWidth
          />
          
          <NumberInput
            source="rateLimit"
            label="速率限制"
            validate={[required()]}
            min={1}
            helperText="每分钟允许的请求数"
            fullWidth
          />
          
          <TextInput
            source="tokenReset"
            label="Token重置周期"
            defaultValue="monthly"
            helperText="monthly, weekly, daily"
            fullWidth
          />
          
          <BooleanInput
            source="isActive"
            label="是否激活"
            defaultValue={true}
          />
          
          <TextInput
            source="stripePriceId"
            label="Stripe价格ID(月付)"
            helperText="Stripe月付价格ID"
            fullWidth
          />
          
          <TextInput
            source="stripeYearlyPriceId"
            label="Stripe价格ID(年付)"
            helperText="Stripe年付价格ID"
            fullWidth
          />
          
          <Divider sx={{ my: 2 }} />
          
          {/* Token购买配置 */}
          <Typography variant="h6" gutterBottom>
            Token购买配置
          </Typography>
          
          <BooleanInput
            source="allowExtraTokens"
            label="允许额外购买Token"
            defaultValue={true}
            helperText="是否允许用户在此套餐下额外购买Token"
            fullWidth
          />
          
          <ArrayInput 
            source="extraTokenOptions" 
            label="Token购买选项"
            helperText="配置用户可购买的Token包"
          >
            <SimpleFormIterator>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 2 }}>
                <Box sx={{ gridColumn: 'span 4' }}>
                  <NumberInput
                    source="tokens"
                    label="Token数量"
                    validate={[required()]}
                    min={1}
                    fullWidth
                  />
                </Box>
                <Box sx={{ gridColumn: 'span 4' }}>
                  <NumberInput
                    source="price"
                    label="价格"
                    validate={[required()]}
                    min={0}
                    step={0.01}
                    fullWidth
                  />
                </Box>
                <Box sx={{ gridColumn: 'span 4' }}>
                  <SelectInput
                    source="currency"
                    choices={[
                      { id: 'USD', name: '美元' },
                      { id: 'CNY', name: '人民币' },
                    ]}
                    defaultValue="USD"
                    validate={[required()]}
                    fullWidth
                  />
                </Box>
              </Box>
            </SimpleFormIterator>
          </ArrayInput>
          
          <Divider sx={{ my: 2 }} />
          
          <PlanFeaturesEdit />
        </Box>
      </SimpleForm>
    </Edit>
  );
};
