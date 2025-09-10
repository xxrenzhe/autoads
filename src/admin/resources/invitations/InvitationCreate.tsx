import React from 'react';
import {
  Create,
  SimpleForm,
  ReferenceInput,
  SelectInput,
  NumberInput,
  DateTimeInput,
  TextInput,
  useTranslate,
  useNotify,
  useRedirect,
} from 'react-admin';
import { Box, Card, CardContent, Typography } from '@mui/material';

export const InvitationCreate: React.FC = () => {
  const translate = useTranslate();
  const notify = useNotify();
  const redirect = useRedirect();
  
  const transform = (data: any) => {
    // Set default values
    return {
      ...data,
      status: 'PENDING',
      tokensReward: data.tokensReward || 100
    };
  };
  
  return (
    <Create transform={transform}>
      <SimpleForm>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
          <Box sx={{ flex: 1, minWidth: 300 }}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  基本信息
                </Typography>
                
                <ReferenceInput 
                  source="inviterId" 
                  reference="users" 
                  label="邀请者"
                  fullWidth
                  required
                >
                  <SelectInput optionText="email" />
                </ReferenceInput>
                
                <NumberInput 
                  source="tokensReward" 
                  label="奖励Token数量"
                  defaultValue={100}
                  min={0}
                  fullWidth
                />
                
                <TextInput 
                  source="email" 
                  label="预注册邮箱"
                  type="email"
                  fullWidth
                />
              </CardContent>
            </Card>
          </Box>
          
          <Box sx={{ flex: 1, minWidth: 300 }}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  时间设置
                </Typography>
                
                <DateTimeInput 
                  source="expiresAt" 
                  label="过期时间"
                  defaultValue={() => {
                    const date = new Date();
                    date.setDate(date.getDate() + 30);
                    return date;
                  }}
                  fullWidth
                />
                
                <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
                  留空表示永不过期
                </Typography>
              </CardContent>
            </Card>
          </Box>
        </Box>
        
        <Box sx={{ mt: 2 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                说明
              </Typography>
              <Typography variant="body2" color="textSecondary">
                • 创建邀请码后，系统将自动生成唯一的8位邀请码
                <br />
                • 邀请码默认30天后过期，可自定义过期时间
                <br />
                • 邀请者将获得与奖励Token等值的推荐Token
                <br />
                • 使用邀请码注册的用户将获得奖励Token和Pro套餐
              </Typography>
            </CardContent>
          </Card>
        </Box>
      </SimpleForm>
    </Create>
  );
};