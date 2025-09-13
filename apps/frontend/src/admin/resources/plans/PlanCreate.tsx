import React, { useState } from 'react';
import {
  Create,
  SimpleForm,
  TextInput,
  NumberInput,
  SelectInput,
  BooleanInput,
  ArrayInput,
  SimpleFormIterator,
  required,
  Button,
  SaveButton,
  Toolbar,
  useNotify,
  useRedirect,
} from 'react-admin';
import { Box, Typography, Divider, Card, CardContent, Chip, Alert } from '@mui/material';
import { ContentCopy as CopyIcon, Add as AddIcon } from '@mui/icons-material';

const intervalChoices = [
  { id: 'MONTH', name: '月付' },
  { id: 'YEAR', name: '年付' },
];

const billingPeriodChoices = [
  { id: 'MONTHLY', name: '按月计费' },
  { id: 'YEARLY', name: '按年计费' },
];

const featureChoices = [
  { id: 'batchopen_basic', name: '真实点击-初级版本' },
  { id: 'batchopen_silent', name: '真实点击-静默版本' },
  { id: 'batchopen_platinum', name: '真实点击-白金版本' },
  { id: 'siterank_basic', name: '网站排名-基础版' },
  { id: 'siterank_pro', name: '网站排名-专业版' },
  { id: 'siterank_max', name: '网站排名-企业版' },
  { id: 'adscenter_basic', name: '自动化广告-基础版' },
  { id: 'adscenter_pro', name: '自动化广告-高级版' },
  { id: 'api_advanced', name: '高级API访问' },
  { id: 'priority_support', name: '优先技术支持' },
];

const defaultPlans = {
  free: {
    id: 'free',
    name: '免费套餐',
    description: '适合个人用户免费试用',
    price: 0,
    currency: 'CNY',
    interval: 'MONTH',
    billingPeriod: 'MONTHLY',
    tokenQuota: 1000,
    rateLimit: 30,
    tokenReset: 'monthly',
    status: 'ACTIVE',
    displayOrder: 1,
    features: ['batchopen_basic', 'batchopen_silent', 'siterank_basic'],
    metadata: {
      category: 'free',
      yearlyDiscount: 0,
      highlightFeatures: [
        '支持"真实点击"功能（初级版本和静默版本）',
        '支持"网站排名"功能',
        '批量查询域名上限100个/次'
      ]
    },
    limits: {
      siterank: { dailyQueries: 100, batchLimit: 100 },
      batchopen: { dailyUrls: 100, versions: ['basic', 'silent'] },
      adscenter: { maxCampaigns: 0 },
      api: { rateLimit: 30, dailyRequests: 1000 }
    },
    extraTokenOptions: [
      { tokens: 1000, price: 9.9, currency: 'CNY' },
      { tokens: 5000, price: 39.9, currency: 'CNY' }
    ]
  },
  pro: {
    id: 'pro',
    name: '高级套餐',
    description: '适合专业用户和小型团队',
    price: 298,
    currency: 'CNY',
    interval: 'MONTH',
    billingPeriod: 'MONTHLY',
    tokenQuota: 10000,
    rateLimit: 100,
    tokenReset: 'monthly',
    status: 'ACTIVE',
    displayOrder: 2,
    stripePriceId: 'price_pro_monthly',
    stripeYearlyPriceId: 'price_pro_yearly',
    features: ['batchopen_basic', 'batchopen_silent', 'batchopen_platinum', 'siterank_pro', 'adscenter_basic'],
    metadata: {
      category: 'pro',
      yearlyDiscount: 0.5,
      highlightFeatures: [
        '所有免费套餐功能',
        '"真实点击"功能支持"白金版本"',
        '"网站排名"批量查询域名上限500个/次',
        '支持"自动化广告"功能，批量管理ads账号（上限10个）'
      ]
    },
    limits: {
      siterank: { dailyQueries: 500, batchLimit: 500 },
      batchopen: { dailyUrls: 500, versions: ['basic', 'silent', 'platinum'] },
      adscenter: { maxCampaigns: 10, maxAccounts: 10 },
      api: { rateLimit: 100, dailyRequests: 10000 }
    },
    extraTokenOptions: [
      { tokens: 1000, price: 8, currency: 'CNY' },
      { tokens: 5000, price: 35, currency: 'CNY' },
      { tokens: 10000, price: 65, currency: 'CNY' }
    ]
  },
  max: {
    id: 'max',
    name: '白金套餐',
    description: '适合大型企业和高级用户',
    price: 998,
    currency: 'CNY',
    interval: 'MONTH',
    billingPeriod: 'MONTHLY',
    tokenQuota: 100000,
    rateLimit: 500,
    tokenReset: 'monthly',
    status: 'ACTIVE',
    displayOrder: 3,
    stripePriceId: 'price_max_monthly',
    stripeYearlyPriceId: 'price_max_yearly',
    features: ['batchopen_basic', 'batchopen_silent', 'batchopen_platinum', 'siterank_max', 'adscenter_pro', 'api_advanced', 'priority_support'],
    metadata: {
      category: 'max',
      yearlyDiscount: 0.5,
      highlightFeatures: [
        '所有高级套餐功能',
        '"网站排名"批量查询域名上限9999个/次',
        '"自动化广告"批量管理ads账号（上限100个）',
        '支持其他高级功能'
      ]
    },
    limits: {
      siterank: { dailyQueries: 9999, batchLimit: 9999 },
      batchopen: { dailyUrls: 2000, versions: ['basic', 'silent', 'platinum'] },
      adscenter: { maxCampaigns: 100, maxAccounts: 100 },
      api: { rateLimit: 500, dailyRequests: 100000 }
    },
    extraTokenOptions: [
      { tokens: 1000, price: 7, currency: 'CNY' },
      { tokens: 5000, price: 30, currency: 'CNY' },
      { tokens: 10000, price: 55, currency: 'CNY' },
      { tokens: 50000, price: 250, currency: 'CNY' }
    ]
  }
};

// 套餐模板选择组件
const PlanTemplateSelector: React.FC<{ onSelect: (template: any) => void }> = ({ onSelect }) => {
  return (
    <Box sx={{ mb: 3 }}>
      <Typography variant="h6" gutterBottom>
        选择套餐模板
      </Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 2 }}>
        {Object.entries(defaultPlans).map(([key, plan]: any) => (
          <Box key={key} sx={{ gridColumn: 'span 12', md: { gridColumn: 'span 4' } }}>
            <Card 
              sx={{ 
                cursor: 'pointer',
                border: '2px solid transparent',
                '&:hover': { 
                  borderColor: 'primary.main',
                  transform: 'translateY(-2px)',
                  boxShadow: 2
                }
              }}
              onClick={() => onSelect(plan)}
            >
              <CardContent sx={{ textAlign: 'center' }}>
                <Typography variant="h5" component="div" gutterBottom>
                  {plan.name}
                </Typography>
                <Typography variant="h4" color="primary" sx={{ mb: 1 }}>
                  {plan.price === 0 ? '免费' : `¥${plan.price}/月`}
                </Typography>
                {plan.metadata?.yearlyDiscount > 0 && (
                  <Chip 
                    label={`年付优惠${plan.metadata.yearlyDiscount * 100}%`}
                    color="secondary"
                    size="small"
                    sx={{ mb: 2 }}
                  />
                )}
                <Box sx={{ textAlign: 'left', mt: 2 }}>
                  {plan.metadata?.highlightFeatures?.slice(0, 3).map((feature: string, index: number) => (
                    <Typography key={index} variant="body2" sx={{ mb: 0.5 }}>
                      • {feature}
                    </Typography>
                  ))}
                </Box>
                <Button
                  variant="outlined"
                  size="small"
                  sx={{ mt: 2 }}
                  startIcon={<CopyIcon />}
                >
                  使用模板
                </Button>
              </CardContent>
            </Card>
          </Box>
        ))}
      </Box>
    </Box>
  );
};

// 自定义工具栏
const PlanCreateToolbar = (props: any) => {
  const { selectedTemplate, setSelectedTemplate } = props;
  
  return (
    <Toolbar {...props}>
      <SaveButton label="创建套餐" />
      {selectedTemplate && (
        <Button
          color="secondary"
          onClick={() => setSelectedTemplate(null)}
          sx={{ ml: 2 }}
        >
          清除模板
        </Button>
      )}
    </Toolbar>
  );
};

export const PlanCreate: React.FC = () => {
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const notify = useNotify();
  const redirect = useRedirect();

  const handleTemplateSelect = (template: any) => {
    setSelectedTemplate(template);
    notify(`已选择${template.name}模板`, { type: 'info' });
  };

  const handleSuccess = () => {
    notify('套餐创建成功', { type: 'success' });
    redirect('list', 'plans');
  };

  return (
    <Create title="创建套餐">
      <SimpleForm 
        defaultValues={selectedTemplate || defaultPlans.free}
        toolbar={<PlanCreateToolbar selectedTemplate={selectedTemplate} setSelectedTemplate={setSelectedTemplate} />}
        onSubmit={handleSuccess}
      >
        <Box sx={{ width: '100%', maxWidth: 1200 }}>
          {!selectedTemplate && <PlanTemplateSelector onSelect={handleTemplateSelect} />}
          
          {selectedTemplate && (
            <Alert severity="info" sx={{ mb: 3 }}>
              当前使用 <strong>{selectedTemplate.name}</strong> 模板，所有参数都可以修改
            </Alert>
          )}
          
          <Divider sx={{ my: 3 }} />
          
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
          
          {/* 功能配置 */}
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
          
          {/* 功能限制配置 */}
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
            label="ChangeLink最大活动数"
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
      </SimpleForm>
    </Create>
  );
};
