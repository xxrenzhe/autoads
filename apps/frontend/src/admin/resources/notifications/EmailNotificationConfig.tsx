import React, { useState, useEffect } from 'react';
import {
  Edit,
  SimpleForm,
  TextInput,
  SelectInput,
  BooleanInput,
  NumberInput,
  FormDataConsumer,
  useEditContext,
  useNotify,
  useRefresh,
  Button,
  SaveButton,
  Toolbar,
} from 'react-admin';
import {
  Email,
  Send,
  Science as Test,
  Settings as SettingsIcon,
  Security,
  Notifications,
} from '@mui/icons-material';
import { Box, Card, CardContent, Typography, Divider, Alert, Stack } from '@mui/material';
import { TestEmailModal } from './TestEmailModal';

const EmailConfigToolbar = (props: any) => {
  const [openTestModal, setOpenTestModal] = useState(false);
  const { record } = useEditContext();
  const notify = useNotify();
  const refresh = useRefresh();

  const handleTestEmail = async (testData: any) => {
    try {
      const response = await fetch('/api/admin/notifications/test-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(testData),
      });

      if (response.ok) {
        notify('测试邮件发送成功', { type: 'success' });
      } else {
        const error = await response.json();
        notify(`发送失败: ${error.message}`, { type: 'error' });
      }
    } catch (err) {
      notify('发送失败: 网络错误', { type: 'error' });
    }
  };

  return (
    <Toolbar {...props}>
      <SaveButton />
      <Button
        label="测试邮件"
        onClick={((: any): any) => setOpenTestModal(true)}
        startIcon={<Test />}
        sx={{ ml: 1 }}
      >
        测试邮件
      </Button>
      {openTestModal && (
        <TestEmailModal
          open={openTestModal}
          onClose={() => setOpenTestModal(false)}
          onSend={handleTestEmail}
          defaultEmail={record?.smtpFrom}
        />
      )}
    </Toolbar>
  );
};

const SmtpConfiguration = () => (
  <Card>
    <CardContent>
      <Box display="flex" alignItems="center" mb={2}>
        <Email color="primary" sx={{ mr: 1 }} />
        <Typography variant="h6">SMTP 服务器配置</Typography>
      </Box>
      
      <Stack spacing={2}>
        <SelectInput
          source="emailConfig.provider"
          choices={[
            { id: 'smtp', name: '自定义 SMTP' },
            { id: 'sendgrid', name: 'SendGrid' },
            { id: 'ses', name: 'Amazon SES' },
            { id: 'mailgun', name: 'Mailgun' },
          ]}
          label="邮件服务提供商"
          fullWidth
        />

        <FormDataConsumer>
          {({ formData, ...rest }) => {
            if (formData?.emailConfig?.provider === 'smtp') {
              return (
                <>
                  <TextInput
                    source="emailConfig.smtp.host"
                    label="SMTP 服务器地址"
                    placeholder="smtp.example.com"
                    fullWidth
                  />
                  <Box display="flex" gap={2}>
                    <NumberInput
                      source="emailConfig.smtp.port"
                      label="端口"
                      defaultValue={587}
                      min={1}
                      max={65535}
                    />
                    <SelectInput
                      source="emailConfig.smtp.secure"
                      choices={[
                        { id: 'true', name: 'SSL/TLS' },
                        { id: 'false', name: 'STARTTLS' },
                      ]}
                      label="加密方式"
                      defaultValue="false"
                    />
                  </Box>
                  <TextInput
                    source="emailConfig.smtp.user"
                    label="用户名"
                    fullWidth
                  />
                  <TextInput
                    source="emailConfig.smtp.pass"
                    label="密码"
                    type="password"
                    fullWidth
                  />
                </>
              );
            }
            return null;
          }}
        </FormDataConsumer>

        <TextInput
          source="emailConfig.from"
          label="发件人邮箱"
          placeholder="noreply@example.com"
          fullWidth
        />
        <TextInput
          source="emailConfig.fromName"
          label="发件人名称"
          placeholder="系统通知"
          fullWidth
        />
      </Stack>
    </CardContent>
  </Card>
);

const EmailNotificationSettings = () => (
  <Card>
    <CardContent>
      <Box display="flex" alignItems="center" mb={2}>
        <Notifications color="primary" sx={{ mr: 1 }} />
        <Typography variant="h6">邮件通知设置</Typography>
      </Box>
      
      <Stack spacing={2}>
        <BooleanInput
          source="emailConfig.enabled"
          label="启用邮件通知"
          defaultValue={false}
        />
        
        <FormDataConsumer>
          {({ formData }) => (
            formData?.emailConfig?.enabled && (
              <>
                <Box display="flex" gap={2}>
                  <NumberInput
                    source="emailConfig.rateLimit"
                    label="发送速率限制（封/分钟）"
                    defaultValue={60}
                    min={1}
                    helperText="防止邮件发送过快被标记为垃圾邮件"
                  />
                  <NumberInput
                    source="emailConfig.maxRetries"
                    label="最大重试次数"
                    defaultValue={3}
                    min={0}
                    max={5}
                  />
                </Box>
                
                <Divider />
                
                <Typography variant="subtitle1" gutterBottom>
                  触发事件
                </Typography>
                
                <BooleanInput
                  source="emailConfig.events.userRegistration"
                  label="用户注册"
                  defaultValue={true}
                />
                <BooleanInput
                  source="emailConfig.events.passwordReset"
                  label="密码重置"
                  defaultValue={true}
                />
                <BooleanInput
                  source="emailConfig.events.subscriptionCreated"
                  label="订阅创建"
                  defaultValue={true}
                />
                <BooleanInput
                  source="emailConfig.events.subscriptionExpired"
                  label="订阅过期"
                  defaultValue={true}
                />
                <BooleanInput
                  source="emailConfig.events.paymentFailed"
                  label="支付失败"
                  defaultValue={true}
                />
                <BooleanInput
                  source="emailConfig.events.tokenLow"
                  label="Token 余额不足"
                  defaultValue={false}
                />
              </>
            )
          )}
        </FormDataConsumer>
      </Stack>
    </CardContent>
  </Card>
);

const SecuritySettings = () => (
  <Card>
    <CardContent>
      <Box display="flex" alignItems="center" mb={2}>
        <Security color="primary" sx={{ mr: 1 }} />
        <Typography variant="h6">安全设置</Typography>
      </Box>
      
      <Stack spacing={2}>
        <Alert severity="info">
          配置 DKIM、SPF 和 DMARC 可以提高邮件送达率并防止垃圾邮件标记
        </Alert>
        
        <TextInput
          source="emailConfig.dkim.domain"
          label="DKIM 域名"
          placeholder="example.com"
          helperText="用于 DKIM 签名的域名"
        />
        <TextInput
          source="emailConfig.dkim.selector"
          label="DKIM 选择器"
          placeholder="default"
        />
        <TextInput
          source="emailConfig.dkim.privateKey"
          label="DKIM 私钥"
          multiline
          rows={4}
          helperText="DKIM 私钥，请妥善保管"
        />
      </Stack>
    </CardContent>
  </Card>
);

export const EmailNotificationConfig: React.FC = () => {
  return (
    <Edit
      title="邮件通知配置"
      mutationMode="pessimistic"
      redirect={false}
      actions={<EmailConfigToolbar />}
    >
      <SimpleForm>
        <Box display={{ xs: 'block', lg: 'flex' }} flexDirection="column" gap={3}>
          <SmtpConfiguration />
          <EmailNotificationSettings />
          <SecuritySettings />
        </Box>
      </SimpleForm>
    </Edit>
  );
};