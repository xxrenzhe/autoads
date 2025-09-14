import React from 'react';
import { Admin, Resource, CustomRoutes } from 'react-admin';
import { RouterProvider, createHashRouter } from 'react-router-dom';
import { EnvReloadProvider } from '@/contexts/EnvReloadContext';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Import all the same components as AdminApp
import {
  People,
  Subscriptions,
  Business,
  Settings,
  Payment,
  Notifications as NotificationsIcon,
  Api,
  Analytics,
  Token,
  Dashboard,
  Block,
  Email,
} from '@mui/icons-material';
import { Route } from 'react-router-dom';

// Feature flag from remote-config (ENV fallback)
import { paymentsEnabled } from '@/lib/config/feature-flags';
const PAYMENTS_ENABLED = paymentsEnabled();

// Providers
import { autoAdsDataProvider } from './providers/AutoAdsDataProvider';
import { createNextAuthAuthProvider, withNextAuth } from './providers/NextAuthAuthProvider';

// Theme and Layout
import { adminTheme, adminDarkTheme } from './theme/adminTheme';
import { CustomLayout } from './components/CustomLayout';

// Import all resources and components from AdminApp
import { UserList } from './resources/users/UserList';
import { UserEdit } from './resources/users/UserEdit';
import { UserCreate } from './resources/users/UserCreate';
import { UserShow } from './resources/users/UserShow';
import { RoleList } from './resources/roles/RoleList';
import { RoleEdit } from './resources/roles/RoleEdit';
import { RoleCreate } from './resources/roles/RoleCreate';
import { PlanList } from './resources/plans/PlanList';
import { PlanEdit } from './resources/plans/PlanEdit';
import { PlanCreate } from './resources/plans/PlanCreate';
import { SubscriptionList } from './resources/subscriptions/SubscriptionList';
import { SubscriptionEdit } from './resources/subscriptions/SubscriptionEdit';
import { SubscriptionShow } from './resources/subscriptions/SubscriptionShow';
import { SubscriptionCreate } from './resources/subscriptions/SubscriptionCreate';
import { ConfigList } from './resources/config/ConfigList';
import { ConfigEdit } from './resources/config/ConfigEdit';
import { EnvVarList } from './resources/config/EnvVarList';
import { EnvVarEdit } from './resources/config/EnvVarEdit';
import { EnvVarManager } from './resources/config/EnvVarManager';
import { RateLimitList } from './resources/config/RateLimitList';
import { RateLimitEdit } from './resources/config/RateLimitEdit';
import { TokenList } from './resources/tokens/TokenList';
import { TokenEdit } from './resources/tokens/TokenEdit';
import { TransactionList } from './resources/tokens/TransactionList';
import { TokenTransactionList } from './resources/tokens/TokenTransactionList';
import { TokenPurchaseList } from './resources/tokens/TokenPurchaseList';
import { TokenPurchaseEdit } from './resources/tokens/TokenPurchaseEdit';
import { PaymentProviderList } from './resources/payments/PaymentProviderList';
import { PaymentProviderEdit } from './resources/payments/PaymentProviderEdit';
import { PaymentList } from './resources/payments/PaymentList';
import { NotificationList } from './resources/notifications/NotificationList';
import { NotificationEdit } from './resources/notifications/NotificationEdit';
import { NotificationShow } from './resources/notifications/NotificationShow';
import { NotificationCreate } from './resources/notifications/NotificationCreate';
import { TemplateList } from './resources/notifications/TemplateList';
import { AppNotificationList } from './resources/notifications/AppNotificationList';
import { EmailNotificationConfig } from './resources/notifications/EmailNotificationConfig';
import { ApiUsageList } from './resources/api/ApiUsageList';
import ApiAnalyticsDashboard from './resources/api/ApiAnalyticsDashboard';
import { CheckInList } from './resources/check-ins/CheckInList';
import { InvitationList } from './resources/invitations/InvitationList';
import { InvitationEdit } from './resources/invitations/InvitationEdit';
import { InvitationCreate } from './resources/invitations/InvitationCreate';
import { InvitationShow } from './resources/invitations/InvitationShow';
import AdminDashboard from './components/Dashboard';
import { UserStatisticsDashboard } from './components/statistics/UserStatisticsDashboard';
import { RestrictionList } from './resources/restrictions/RestrictionList';
import { RestrictionEdit } from './resources/restrictions/RestrictionEdit';
import { RestrictionCreate } from './resources/restrictions/RestrictionCreate';
import { RestrictionShow } from './resources/restrictions/RestrictionShow';

// Create the Admin content component
const AdminContent: React.FC = () => {
  const authProvider = createNextAuthAuthProvider();
  
  return (
    <Admin
      dataProvider={autoAdsDataProvider}
      authProvider={authProvider}
      dashboard={AdminDashboard}
      layout={CustomLayout}
      title="AutoAds Admin"
      theme={adminTheme}
      darkTheme={adminDarkTheme}
      requireAuth
    >
      {/* Dashboard */}
      <CustomRoutes noLayout>
        <Route path="/api-analytics" element={<ApiAnalyticsDashboard />} />
        <Route path="/user-statistics" element={<UserStatisticsDashboard />} />
      </CustomRoutes>

      {/* User Management */}
      <Resource
        name="users"
        list={UserList}
        edit={UserEdit}
        create={UserCreate}
        show={UserShow}
        icon={People}
        options={{ label: '用户管理' }}
      />

      {/* Restriction Management */}
      <Resource
        name="userRestrictions"
        list={RestrictionList}
        edit={RestrictionEdit}
        create={RestrictionCreate}
        show={RestrictionShow}
        icon={Block}
        options={{ label: '用户限制' }}
      />

      {/* Role Management */}
      <Resource
        name="roles"
        list={RoleList}
        edit={RoleEdit}
        create={RoleCreate}
        icon={People}
        options={{ label: '角色管理' }}
      />

      {/* Plan Management */}
      <Resource
        name="plans"
        list={PlanList}
        edit={PlanEdit}
        create={PlanCreate}
        icon={Business}
        options={{ label: '套餐管理' }}
      />

      {/* Subscription Management */}
      <Resource
        name="subscriptions"
        list={SubscriptionList}
        edit={SubscriptionEdit}
        create={SubscriptionCreate}
        show={SubscriptionShow}
        icon={Subscriptions}
        options={{ label: '订阅管理' }}
      />

      {/* Token Management */}
      <Resource
        name="token-usage"
        list={TokenList}
        edit={TokenEdit}
        icon={Token}
        options={{ label: 'Token管理' }}
      />

      <Resource
        name="token-transactions"
        list={TokenTransactionList}
        icon={Token}
        options={{ label: 'Token交易' }}
      />

      <Resource
        name="token-purchases"
        list={TokenPurchaseList}
        edit={TokenPurchaseEdit}
        icon={Token}
        options={{ label: 'Token购买记录' }}
      />

      {/* Configuration Management */}
      <Resource
        name="system-configs"
        list={ConfigList}
        edit={ConfigEdit}
        icon={Settings}
        options={{ label: '系统配置' }}
      />

      <Resource
        name="env-vars"
        list={EnvVarManager}
        edit={EnvVarEdit}
        icon={Settings}
        options={{ label: '环境变量' }}
      />

      <Resource
        name="rate-limits"
        list={RateLimitList}
        edit={RateLimitEdit}
        icon={Settings}
        options={{ label: '限速配置' }}
      />

      <Resource
        name="email-config"
        list={EmailNotificationConfig}
        icon={Email}
        options={{ label: '邮件配置' }}
      />

      {/* Payment Management */}
      {PAYMENTS_ENABLED && (
        <>
          <Resource
            name="payment-providers"
            list={PaymentProviderList}
            edit={PaymentProviderEdit}
            icon={Payment}
            options={{ label: '支付配置' }}
          />

          <Resource
            name="payments"
            list={PaymentList}
            icon={Payment}
            options={{ label: '支付记录' }}
          />
        </>
      )}

      {/* Notification Management */}
      <Resource
        name="notifications"
        list={NotificationList}
        edit={NotificationEdit}
        create={NotificationCreate}
        show={NotificationShow}
        icon={NotificationsIcon}
        options={{ label: '邮件通知' }}
      />

      <Resource
        name="notification-templates"
        list={TemplateList}
        icon={NotificationsIcon}
        options={{ label: '通知模板' }}
      />

      <Resource
        name="app-notifications"
        list={AppNotificationList}
        icon={NotificationsIcon}
        options={{ label: '应用内通知' }}
      />

      {/* API Management */}
      <Resource
        name="api-usage"
        list={ApiUsageList}
        icon={Api}
        options={{ label: 'API使用统计' }}
      />

      {/* Check-in Management */}
      <Resource
        name="check-ins"
        list={CheckInList}
        icon={Dashboard}
        options={{ label: '签到记录' }}
      />

      {/* Invitation Management */}
      <Resource
        name="invitations"
        list={InvitationList}
        edit={InvitationEdit}
        create={InvitationCreate}
        show={InvitationShow}
        icon={Dashboard}
        options={{ label: '邀请记录' }}
      />
    </Admin>
  );
};

// Create the custom router
const createAdminRouter = () => {
  return createHashRouter([
    {
      path: "*",
      element: <AdminContent />,
    },
  ]);
};

// Main Admin App component with custom router
const AdminAppWithRouter: React.FC = () => {
  const router = createAdminRouter();
  
  return (
    <EnvReloadProvider>
      <ToastContainer
        position="top-right"
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="light"
      />
      <RouterProvider router={router} />
    </EnvReloadProvider>
  );
};

export const AdminApp = withNextAuth(AdminAppWithRouter);
