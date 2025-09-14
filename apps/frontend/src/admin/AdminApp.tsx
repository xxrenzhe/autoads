import React from 'react';
import {
  Admin,
  Resource,
  CustomRoutes,
} from 'react-admin';
import { EnvReloadProvider } from '@/contexts/EnvReloadContext';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
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
  TouchApp,
} from '@mui/icons-material';
import { Route } from 'react-router-dom';

// Providers
import { autoAdsDataProvider } from './providers/AutoAdsDataProvider';
import { ApiEndpointsDataProvider } from './providers/ApiEndpointsDataProvider';
import { createNextAuthAuthProvider, withNextAuth } from './providers/NextAuthAuthProvider';

// Theme and Layout
import { adminTheme, adminDarkTheme } from './theme/adminTheme';
import { CustomLayout } from './components/CustomLayout';

// User Management Resources
import { UserList } from './resources/users/UserList';
import { UserEdit } from './resources/users/UserEdit';
import { UserCreate } from './resources/users/UserCreate';
import { UserShow } from './resources/users/UserShow';

// Role Management Resources
import { RoleList } from './resources/roles/RoleList';
import { RoleEdit } from './resources/roles/RoleEdit';
import { RoleCreate } from './resources/roles/RoleCreate';

// Plan Management Resources
import { PlanList } from './resources/plans/PlanList';
import { PlanEdit } from './resources/plans/PlanEdit';
import { PlanCreate } from './resources/plans/PlanCreate';

// Subscription Management Resources
import { SubscriptionList } from './resources/subscriptions/SubscriptionList';
import { SubscriptionEdit } from './resources/subscriptions/SubscriptionEdit';
import { SubscriptionShow } from './resources/subscriptions/SubscriptionShow';
import { SubscriptionCreate } from './resources/subscriptions/SubscriptionCreate';

// Configuration Management Resources
import { ConfigList } from './resources/config/ConfigList';
import { ConfigEdit } from './resources/config/ConfigEdit';
import { EnvVarList } from './resources/config/EnvVarList';
import { EnvVarEdit } from './resources/config/EnvVarEdit';
import { EnvVarManager } from './resources/config/EnvVarManager';
import EnvVarManagerEnhanced from './resources/config/EnvVarManagerEnhanced';
import { RateLimitList } from './resources/config/RateLimitList';
import { RateLimitEdit } from './resources/config/RateLimitEdit';
import RateLimitConfigEnhanced from './resources/config/RateLimitConfigEnhanced';
import { EmailConfigEnhanced } from './resources/config/EmailConfigEnhanced';

// Token Management Resources
import { TokenList } from './resources/tokens/TokenList';
import { TokenEdit } from './resources/tokens/TokenEdit';
import { TransactionList } from './resources/tokens/TransactionList';
import { TokenTransactionList } from './resources/tokens/TokenTransactionList';
import { TokenPurchaseList } from './resources/tokens/TokenPurchaseList';
import { TokenPurchaseEdit } from './resources/tokens/TokenPurchaseEdit';

// Payment Management Resources
import { PaymentProviderListEnhanced } from './resources/payments/PaymentProviderListEnhanced';
import { PaymentProviderEdit } from './resources/payments/PaymentProviderEdit';
import { PaymentListEnhanced } from './resources/payments/PaymentListEnhanced';


// Notification Management Resources
import { NotificationList } from './resources/notifications/NotificationList';
import { NotificationEdit } from './resources/notifications/NotificationEdit';
import { NotificationShow } from './resources/notifications/NotificationShow';
import { NotificationCreate } from './resources/notifications/NotificationCreate';
import { TemplateList } from './resources/notifications/TemplateList';
import { AppNotificationList } from './resources/notifications/AppNotificationList';
import { AppNotificationEdit } from './resources/notifications/AppNotificationEdit';
import { AppNotificationCreate } from './resources/notifications/AppNotificationCreate';
import { EmailNotificationConfig } from './resources/notifications/EmailNotificationConfig';

// API Management Resources
import { ApiUsageList } from './resources/api/ApiUsageList';
import { ApiList } from './resources/api/ApiList';
import ApiAnalyticsDashboard from './resources/api/ApiAnalyticsDashboard';

// AutoClick Management Resources
import { AutoClickTaskList } from './resources/autoclick/AutoClickTaskList';

// Check-in Management Resources
import { CheckInList } from './resources/check-ins/CheckInList';

// Invitation Management Resources
import { InvitationList } from './resources/invitations/InvitationList';
import { InvitationEdit } from './resources/invitations/InvitationEdit';
import { InvitationCreate } from './resources/invitations/InvitationCreate';
import { InvitationShow } from './resources/invitations/InvitationShow';
import { paymentsEnabled } from '@/lib/config/feature-flags';

// Anti-Cheat Management Resources
import { AntiCheatAdmin } from './resources/anti-cheat';

// Dashboard Components
import AdminDashboard from './components/Dashboard';
import UserRegistrationDashboard from './components/user-statistics/UserRegistrationDashboard';
import RoleManagementPage from './components/roles/RoleManagementPage';
import TokenUsageAnalysis from './components/tokens/TokenUsageAnalysis';
import TokenConsumptionRules from './components/tokens/TokenConsumptionRules';
import SubscriptionPermissionsManagement from './components/subscription/SubscriptionPermissionsPage';

// Restriction Management Resources
import { RestrictionList } from './resources/restrictions/RestrictionList';
import { RestrictionEdit } from './resources/restrictions/RestrictionEdit';
import { RestrictionCreate } from './resources/restrictions/RestrictionCreate';
import { RestrictionShow } from './resources/restrictions/RestrictionShow';

/**
 * Inner React Admin application component
 */
const InnerAdminApp: React.FC = () => {
  const authProvider = createNextAuthAuthProvider();
  const PAYMENTS_ENABLED = paymentsEnabled();
  
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
          <Route path="/user-statistics" element={<UserRegistrationDashboard />} />
          <Route path="/role-management" element={<RoleManagementPage />} />
          <Route path="/token-usage" element={<TokenUsageAnalysis />} />
          <Route path="/token-rules" element={<TokenConsumptionRules />} />
          <Route path="/subscription-permissions" element={<SubscriptionPermissionsManagement />} />
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
          list={EnvVarManagerEnhanced}
          edit={EnvVarEdit}
          icon={Settings}
          options={{ label: '环境变量' }}
        />

        <Resource
          name="rate-limits"
          list={RateLimitConfigEnhanced}
          edit={RateLimitEdit}
          icon={Settings}
          options={{ label: '限速配置' }}
        />

        <Resource
          name="email-config"
          list={EmailConfigEnhanced}
          icon={Email}
          options={{ label: '邮件配置' }}
        />

        {/* Payment Management */}
        {PAYMENTS_ENABLED && (
          <>
            <Resource
              name="payment-providers"
              list={PaymentProviderListEnhanced}
              edit={PaymentProviderEdit}
              icon={Payment}
              options={{ label: '支付配置' }}
            />

            <Resource
              name="payments"
              list={PaymentListEnhanced}
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
          name="app_notifications"
          list={AppNotificationList}
          edit={AppNotificationEdit}
          create={AppNotificationCreate}
          icon={NotificationsIcon}
          options={{ label: '应用内通知' }}
        />

        {/* API Management */}
        <Resource
          name="api-endpoints"
          list={ApiList}
          icon={Api}
          options={{ label: 'API列表' }}
        />
        
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

        {/* AutoClick Management */}
        <Resource
          name="autoclick-tasks"
          list={AutoClickTaskList}
          icon={TouchApp}
          options={{ label: '自动化点击' }}
        />

        {/* Anti-Cheat Management */}
        <AntiCheatAdmin />
      </Admin>
    </EnvReloadProvider>
  );
};

/**
 * Main React Admin application component wrapped with NextAuth
 */
export const AdminApp = withNextAuth(InnerAdminApp);
