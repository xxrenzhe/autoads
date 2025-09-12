import React, { useState } from 'react';
import {
  Layout,
  AppBar,
  UserMenu,
  MenuItemLink,
  Sidebar,
  Menu,
  useTheme,
} from 'react-admin';
import {
  Box,
  Typography,
  IconButton,
  Avatar,
  Divider,
  useMediaQuery,
  useTheme as useMuiTheme,
} from '@mui/material';
import {
  Dashboard,
  People,
  Settings,
  Assessment,
  Subscriptions,
  Business,
  Brightness4,
  Brightness7,
  MenuOpen,
  Menu as MenuIcon,
  TrendingUp,
  Token,
  Speed,
  Payment,
  Notifications,
  Api,
  Block,
  Email,
  Receipt,
  CardGiftcard,
  PersonAdd,
  Shield,
} from '@mui/icons-material';

/**
 * Custom app bar with branding and responsive design
 */
const CustomAppBar: React.FC = () => {
  const [theme, setTheme] = useTheme();
  const muiTheme = useMuiTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down('md'));

  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  };

  return (
    <AppBar
      sx={{
        '& .RaAppBar-toolbar': {
          paddingX: 2,
          minHeight: 64,
        },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', flexGrow: 1 }}>
        {/* Logo and Title */}
        <Box sx={{ display: 'flex', alignItems: 'center', mr: 2 }}>
          <Avatar
            sx={{
              bgcolor: 'secondary.main',
              width: 40,
              height: 40,
              mr: 1,
            }}
          >
            A
          </Avatar>
          {!isMobile && (
            <Typography variant="h6" component="div" sx={{ fontWeight: 600 }}>
              AutoAds Admin
            </Typography>
          )}
        </Box>
      </Box>

      {/* Theme Toggle */}
      <IconButton
        color="inherit"
        onClick={toggleTheme}
        sx={{ mr: 1 }}
        title={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
      >
        {theme === 'light' ? <Brightness4 /> : <Brightness7 />}
      </IconButton>

      {/* User Menu */}
      <CustomUserMenu />
    </AppBar>
  );
};

/**
 * Custom user menu with additional options
 */
const CustomUserMenu: React.FC = () => {
  return (
    <UserMenu>
      <MenuItemLink
        to="/profile"
        primaryText="Profile"
        leftIcon={<People />}
      />
      <MenuItemLink
        to="/admin/settings"
        primaryText="Settings"
        leftIcon={<Settings />}
      />
      <Divider />
      <MenuItemLink
        to="/help"
        primaryText="Help & Support"
        leftIcon={<Assessment />}
      />
    </UserMenu>
  );
};

/**
 * Custom sidebar with organized menu structure
 */
const CustomSidebar: React.FC = () => {
  return (
    <Sidebar
      sx={{
        '& .RaSidebar-paper': {
          width: 280,
          paddingTop: 1,
        },
      }}
    >
      <Menu>
        {/* 📊 数据面板 */}
        <MenuItemLink
          to="/admin-dashboard"
          primaryText="数据面板"
          leftIcon={<Dashboard />}
        />
        
        <MenuItemLink
          to="/admin-dashboard/user-statistics"
          primaryText="用户统计"
          leftIcon={<TrendingUp />}
        />

        <Divider sx={{ my: 1 }} />

        {/* 👥 用户管理 */}
        <Typography
          variant="overline"
          sx={{
            px: 2,
            py: 1,
            color: 'text.secondary',
            fontWeight: 600,
            fontSize: '0.75rem',
          }}
        >
          👥 用户管理
        </Typography>
        <MenuItemLink
          to="/admin-dashboard/users"
          primaryText="用户列表"
          leftIcon={<People />}
        />
        <MenuItemLink
          to="/admin-dashboard/role-management"
          primaryText="角色管理"
          leftIcon={<People />}
        />

        <Divider sx={{ my: 1 }} />

        {/* 💳 订阅管理 */}
        <Typography
          variant="overline"
          sx={{
            px: 2,
            py: 1,
            color: 'text.secondary',
            fontWeight: 600,
            fontSize: '0.75rem',
          }}
        >
          💳 订阅管理
        </Typography>
        <MenuItemLink
          to="/admin-dashboard/subscriptions"
          primaryText="用户订阅"
          leftIcon={<Subscriptions />}
        />
        <MenuItemLink
          to="/admin-dashboard/plans"
          primaryText="套餐管理"
          leftIcon={<Business />}
        />

        <Divider sx={{ my: 1 }} />

        {/* 🪙 Token 管理 */}
        <Typography
          variant="overline"
          sx={{
            px: 2,
            py: 1,
            color: 'text.secondary',
            fontWeight: 600,
            fontSize: '0.75rem',
          }}
        >
          🪙 Token 管理
        </Typography>
        <MenuItemLink
          to="/admin-dashboard/token-usage"
          primaryText="Token使用"
          leftIcon={<Token />}
        />
        <MenuItemLink
          to="/admin-dashboard/token-purchases"
          primaryText="Token购买记录"
          leftIcon={<Receipt />}
        />
        <MenuItemLink
          to="/admin-dashboard/token-rules"
          primaryText="Token消耗规则"
          leftIcon={<Settings />}
        />

        <Divider sx={{ my: 1 }} />

        {/* ⚙️ 系统配置 */}
        <Typography
          variant="overline"
          sx={{
            px: 2,
            py: 1,
            color: 'text.secondary',
            fontWeight: 600,
            fontSize: '0.75rem',
          }}
        >
          ⚙️ 系统配置
        </Typography>
        <MenuItemLink
          to="/admin-dashboard/system-configs"
          primaryText="系统配置"
          leftIcon={<Settings />}
        />
        <MenuItemLink
          to="/admin-dashboard/env-vars"
          primaryText="环境变量"
          leftIcon={<Settings />}
        />
        <MenuItemLink
          to="/admin-dashboard/rate-limits"
          primaryText="限速配置"
          leftIcon={<Speed />}
        />
        <MenuItemLink
          to="/admin-dashboard/email-config"
          primaryText="邮件配置"
          leftIcon={<Email />}
        />

        <Divider sx={{ my: 1 }} />

        {/* 💰 支付管理 */}
        <Typography
          variant="overline"
          sx={{
            px: 2,
            py: 1,
            color: 'text.secondary',
            fontWeight: 600,
            fontSize: '0.75rem',
          }}
        >
          💰 支付管理
        </Typography>
        <MenuItemLink
          to="/admin-dashboard/payment-providers"
          primaryText="支付渠道"
          leftIcon={<Payment />}
        />
        <MenuItemLink
          to="/admin-dashboard/payments"
          primaryText="支付记录"
          leftIcon={<Payment />}
        />

        <Divider sx={{ my: 1 }} />

        {/* 🔔 通知管理 */}
        <Typography
          variant="overline"
          sx={{
            px: 2,
            py: 1,
            color: 'text.secondary',
            fontWeight: 600,
            fontSize: '0.75rem',
          }}
        >
          🔔 通知管理
        </Typography>
        <MenuItemLink
          to="/admin-dashboard/notifications"
          primaryText="邮件通知"
          leftIcon={<Notifications />}
        />
        <MenuItemLink
          to="/admin-dashboard/notification-templates"
          primaryText="通知模板"
          leftIcon={<Notifications />}
        />
        <MenuItemLink
          to="/admin-dashboard/app-notifications"
          primaryText="应用内通知"
          leftIcon={<Notifications />}
        />

        <Divider sx={{ my: 1 }} />

        {/* 📡 API管理 */}
        <Typography
          variant="overline"
          sx={{
            px: 2,
            py: 1,
            color: 'text.secondary',
            fontWeight: 600,
            fontSize: '0.75rem',
          }}
        >
          📡 API管理
        </Typography>
        <MenuItemLink
          to="/admin-dashboard/api-usage"
          primaryText="API列表"
          leftIcon={<Api />}
        />
        <MenuItemLink
          to="/admin-dashboard/api-analytics"
          primaryText="API分析"
          leftIcon={<Api />}
        />

        <Divider sx={{ my: 1 }} />

        {/* 🎯 用户活动 */}
        <Typography
          variant="overline"
          sx={{
            px: 2,
            py: 1,
            color: 'text.secondary',
            fontWeight: 600,
            fontSize: '0.75rem',
          }}
        >
          🎯 用户活动
        </Typography>
        <MenuItemLink
          to="/admin-dashboard/check-ins"
          primaryText="签到记录"
          leftIcon={<CardGiftcard />}
        />
        <MenuItemLink
          to="/admin-dashboard/anti-cheat"
          primaryText="防作弊监控"
          leftIcon={<Shield />}
        />
        <MenuItemLink
          to="/admin-dashboard/invitations"
          primaryText="邀请记录"
          leftIcon={<PersonAdd />}
        />
      </Menu>
    </Sidebar>
  );
};

/**
 * Custom layout component with responsive design
 */
export const CustomLayout: React.FC = (props: any) => {
  const muiTheme = useMuiTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down('md'));

  return (
    <Layout
      {...props}
      appBar={CustomAppBar}
      sidebar={CustomSidebar}
      sx={{
        '& .RaLayout-content': {
          padding: isMobile ? 2 : 3,
          backgroundColor: 'background.default',
          minHeight: 'calc(100vh - 64px)',
        },
      }}
    />
  );
};