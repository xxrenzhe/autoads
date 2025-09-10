# Comprehensive Admin Management System Design Document

## Design Overview

This design document outlines the complete implementation of a comprehensive admin management system for the AutoAds platform. The design builds upon the existing Clean Architecture foundation while adding all missing functionality specified in the requirements. The system will maintain the stability of core business functions (siterank, batchopen, adscenter) while providing complete administrative capabilities, user management, subscription systems, and payment integration.

## Architecture Principles

### Clean Architecture Foundation
The design maintains the existing four-layer Clean Architecture:

1. **Presentation Layer** - React components, pages, admin interfaces
2. **Application Layer** - Use cases, application services, DTOs
3. **Domain Layer** - Business entities, value objects, domain services
4. **Infrastructure Layer** - Database, external APIs, third-party integrations

### Design Patterns
- **Domain-Driven Design (DDD)** for business logic organization
- **CQRS (Command Query Responsibility Segregation)** for data operations
- **Repository Pattern** for data access abstraction
- **Factory Pattern** for object creation
- **Observer Pattern** for event handling
- **Strategy Pattern** for payment and notification providers

## System Architecture Overview

### High-Level Architecture
```
┌─────────────────────────────────────────────────────────────┐
│                    Presentation Layer                        │
├─────────────────┬─────────────────┬─────────────────────────┤
│   User Portal   │  Admin Portal   │    API Endpoints        │
│   - Dashboard   │  - User Mgmt    │    - REST APIs          │
│   - Features    │  - Config Mgmt  │    - GraphQL (future)   │
│   - Profile     │  - Analytics    │    - WebSocket          │
└─────────────────┴─────────────────┴─────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│                   Application Layer                          │
├─────────────────┬─────────────────┬─────────────────────────┤
│   Use Cases     │   Services      │    Event Handlers       │
│   - User Mgmt   │   - Auth Svc    │    - Domain Events      │
│   - Subscription│   - Payment Svc │    - Integration Events  │
│   - Config Mgmt │   - Notify Svc  │    - System Events      │
└─────────────────┴─────────────────┴─────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│                     Domain Layer                             │
├─────────────────┬─────────────────┬─────────────────────────┤
│    Entities     │  Value Objects  │   Domain Services       │
│    - User       │  - Email        │   - Auth Service        │
│    - Plan       │  - Money        │   - Billing Service     │
│    - Config     │  - TokenAmount  │   - Notification Svc    │
└─────────────────┴─────────────────┴─────────────────────────┘
┌─────────────────────────────────────────────────────────────┐
│                 Infrastructure Layer                         │
├─────────────────┬─────────────────┬─────────────────────────┤
│   Repositories  │  External APIs  │    System Services      │
│   - Prisma ORM  │  - Stripe API   │    - Redis Cache        │
│   - Redis Cache │  - Email APIs   │    - File Storage       │
│   - File System │  - SMS APIs     │    - Monitoring         │
└─────────────────┴─────────────────┴─────────────────────────┘
```

## Database Design

### Enhanced Schema Design
Building on the existing Prisma schema, we need these additions:

#### Admin Management Tables
```prisma
// Admin Dashboard Configuration
model AdminDashboard {
  id          String   @id @default(cuid())
  userId      String   @unique
  layout      Json     // Dashboard layout configuration
  widgets     Json     // Enabled widgets and their settings
  preferences Json     // User preferences for admin interface
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@map("admin_dashboards")
}

// Feature Flags and Configuration
model FeatureFlag {
  id          String   @id @default(cuid())
  name        String   @unique
  description String
  enabled     Boolean  @default(false)
  conditions  Json?    // Conditions for enabling the feature
  rolloutPercentage Int @default(0)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  @@map("feature_flags")
}
```#### Su
bscription and Payment Enhancement
```prisma
// Enhanced Plan Configuration
model PlanFeature {
  id          String   @id @default(cuid())
  planId      String
  featureName String   // siterank, batchopen, adscenter
  enabled     Boolean  @default(true)
  limits      Json     // Feature-specific limits
  config      Json     // Feature-specific configuration
  
  plan Plan @relation(fields: [planId], references: [id], onDelete: Cascade)
  
  @@unique([planId, featureName])
  @@map("plan_features")
}

// Payment Method Management
model PaymentProvider {
  id          String   @id @default(cuid())
  name        String   @unique // stripe, paypal, etc.
  displayName String
  enabled     Boolean  @default(true)
  config      Json     // Provider-specific configuration
  credentials Json     // Encrypted credentials
  priority    Int      @default(0)
  
  @@map("payment_providers")
}

// Subscription Analytics
model SubscriptionAnalytics {
  id             String   @id @default(cuid())
  subscriptionId String
  eventType      String   // created, upgraded, downgraded, cancelled
  fromPlanId     String?
  toPlanId       String?
  revenue        Float?
  metadata       Json?
  timestamp      DateTime @default(now())
  
  subscription Subscription @relation(fields: [subscriptionId], references: [id])
  
  @@map("subscription_analytics")
}
```

#### Configuration Management Tables
```prisma
// Hot-reloadable Configuration
model ConfigurationItem {
  id            String   @id @default(cuid())
  key           String   @unique
  value         String   @db.Text
  type          String   // string, number, boolean, json
  category      String   // database, api, feature, etc.
  description   String
  isSecret      Boolean  @default(false)
  isHotReload   Boolean  @default(true)
  validationRule String? // JSON schema for validation
  defaultValue  String?
  updatedBy     String
  updatedAt     DateTime @updatedAt
  
  user User @relation(fields: [updatedBy], references: [id])
  
  @@map("configuration_items")
}

// Configuration Change History
model ConfigurationHistory {
  id        String   @id @default(cuid())
  configKey String
  oldValue  String?  @db.Text
  newValue  String   @db.Text
  changedBy String
  reason    String?
  timestamp DateTime @default(now())
  
  user User @relation(fields: [changedBy], references: [id])
  
  @@map("configuration_history")
}
```

#### Notification System Tables
```prisma
// Notification Templates
model NotificationTemplate {
  id          String   @id @default(cuid())
  name        String   @unique
  type        String   // email, sms, push, in_app
  subject     String?
  content     String   @db.Text
  variables   Json     // Available template variables
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  notifications NotificationInstance[]
  
  @@map("notification_templates")
}

// Notification Instances
model NotificationInstance {
  id         String   @id @default(cuid())
  templateId String
  userId     String
  channel    String   // email, sms, push, in_app
  recipient  String   // email address, phone number, etc.
  subject    String?
  content    String   @db.Text
  status     String   @default("pending") // pending, sent, failed, delivered
  scheduledAt DateTime?
  sentAt     DateTime?
  deliveredAt DateTime?
  errorMessage String?
  metadata   Json?
  
  template NotificationTemplate @relation(fields: [templateId], references: [id])
  user     User @relation(fields: [userId], references: [id])
  
  @@map("notification_instances")
}

// Notification Preferences
model NotificationPreference {
  id       String  @id @default(cuid())
  userId   String
  channel  String  // email, sms, push, in_app
  type     String  // marketing, transactional, system
  enabled  Boolean @default(true)
  
  user User @relation(fields: [userId], references: [id])
  
  @@unique([userId, channel, type])
  @@map("notification_preferences")
}
```

## API Design

### Admin Management APIs

#### User Management APIs
```typescript
// GET /api/admin/users
interface GetUsersRequest {
  page?: number
  limit?: number
  search?: string
  role?: UserRole
  status?: UserStatus
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

interface GetUsersResponse {
  users: UserWithStats[]
  pagination: PaginationInfo
  stats: UserStats
}

// POST /api/admin/users
interface CreateUserRequest {
  email: string
  name?: string
  role: UserRole
  initialTokens?: number
}

// PUT /api/admin/users/:id
interface UpdateUserRequest {
  name?: string
  role?: UserRole
  status?: UserStatus
  tokenBalance?: number
}

// GET /api/admin/users/:id/analytics
interface UserAnalyticsResponse {
  usage: TokenUsageStats
  activity: UserActivityStats
  subscriptions: SubscriptionHistory
  behavior: BehaviorAnalytics
}
```

#### Configuration Management APIs
```typescript
// GET /api/admin/config
interface GetConfigResponse {
  configurations: ConfigurationItem[]
  categories: string[]
  hotReloadEnabled: boolean
}

// PUT /api/admin/config/:key
interface UpdateConfigRequest {
  value: string
  reason?: string
  hotReload?: boolean
}

// POST /api/admin/config/reload
interface ReloadConfigRequest {
  keys?: string[] // If empty, reload all
  force?: boolean
}

// GET /api/admin/config/history
interface ConfigHistoryResponse {
  changes: ConfigurationHistory[]
  pagination: PaginationInfo
}
```

#### Subscription Management APIs
```typescript
// GET /api/admin/subscriptions
interface GetSubscriptionsResponse {
  subscriptions: SubscriptionWithDetails[]
  analytics: SubscriptionAnalytics
  revenue: RevenueStats
}

// POST /api/admin/plans
interface CreatePlanRequest {
  name: string
  description: string
  price: number
  currency: string
  interval: 'month' | 'year'
  features: PlanFeatureConfig[]
  tokenQuota: number
  stripePriceId?: string
}

// PUT /api/admin/plans/:id
interface UpdatePlanRequest {
  name?: string
  description?: string
  price?: number
  features?: PlanFeatureConfig[]
  isActive?: boolean
}
```

### User Portal APIs

#### Personal Center APIs
```typescript
// GET /api/user/profile
interface UserProfileResponse {
  user: UserProfile
  subscription: UserSubscription
  usage: UsageStats
  preferences: UserPreferences
}

// PUT /api/user/profile
interface UpdateProfileRequest {
  name?: string
  preferences?: UserPreferences
  notificationSettings?: NotificationPreferences
}

// GET /api/user/tokens/detailed
interface DetailedTokenUsageResponse {
  currentBalance: number
  usage: TokenUsageRecord[]
  analytics: TokenAnalytics
  batchOperations: BatchOperationSummary[]
}
```

#### Subscription APIs
```typescript
// GET /api/user/subscription
interface UserSubscriptionResponse {
  current: SubscriptionDetails
  available: PlanOption[]
  billing: BillingHistory
  usage: FeatureUsage
}

// POST /api/user/subscription/upgrade
interface UpgradeSubscriptionRequest {
  planId: string
  paymentMethodId?: string
  billingInterval: 'month' | 'year'
}

// POST /api/user/subscription/cancel
interface CancelSubscriptionRequest {
  reason?: string
  feedback?: string
  cancelAtPeriodEnd: boolean
}
```

## Component Architecture

### Admin Portal Components

#### Admin Layout Structure
```typescript
// src/admin/layouts/AdminLayout.tsx
interface AdminLayoutProps {
  children: React.ReactNode
  title?: string
  breadcrumbs?: BreadcrumbItem[]
  actions?: React.ReactNode
}

// Component hierarchy:
AdminLayout
├── AdminHeader
│   ├── AdminNavigation
│   ├── UserMenu
│   └── NotificationCenter
├── AdminSidebar
│   ├── NavigationMenu
│   ├── QuickActions
│   └── SystemStatus
└── AdminContent
    ├── PageHeader
    ├── ContentArea
    └── ActionBar
```

#### User Management Components
```typescript
// src/admin/components/users/
UserManagement/
├── UserList.tsx           // Main user listing with filters
├── UserDetail.tsx         // Detailed user view
├── UserForm.tsx           // Create/edit user form
├── UserAnalytics.tsx      // User behavior analytics
├── BulkActions.tsx        // Bulk user operations
└── UserActivityLog.tsx    // User activity timeline
```

#### Configuration Management Components
```typescript
// src/admin/components/config/
ConfigurationManagement/
├── ConfigList.tsx         // Configuration items list
├── ConfigEditor.tsx       // Configuration editor
├── ConfigHistory.tsx      // Change history
├── HotReloadStatus.tsx    // Hot reload monitoring
└── ConfigValidation.tsx   // Configuration validation
```

### User Portal Components

#### Personal Center Components
```typescript
// src/components/user/
PersonalCenter/
├── Dashboard.tsx          // Personal dashboard
├── ProfileSettings.tsx    // Profile management
├── TokenUsage.tsx         // Token consumption tracking
├── SubscriptionManager.tsx // Subscription management
├── NotificationSettings.tsx // Notification preferences
└── ActivityHistory.tsx    // User activity log
```

#### Subscription Components
```typescript
// src/components/subscription/
SubscriptionSystem/
├── PricingPage.tsx        // Public pricing display
├── PlanComparison.tsx     // Plan comparison table
├── SubscriptionCard.tsx   // Current subscription display
├── UpgradeFlow.tsx        // Subscription upgrade flow
├── PaymentForm.tsx        // Payment processing form
└── BillingHistory.tsx     // Billing and invoice history
```

## Integration Architecture

### Payment System Integration

#### Stripe Integration
```typescript
// src/lib/payments/stripe/
StripeService/
├── StripeClient.ts        // Stripe API client
├── SubscriptionManager.ts // Subscription lifecycle
├── PaymentProcessor.ts    // Payment processing
├── WebhookHandler.ts      // Stripe webhook handling
└── PriceManager.ts        // Price and product management

interface StripeServiceConfig {
  secretKey: string
  publishableKey: string
  webhookSecret: string
  apiVersion: string
}

class StripeService {
  async createSubscription(params: CreateSubscriptionParams): Promise<Subscription>
  async updateSubscription(params: UpdateSubscriptionParams): Promise<Subscription>
  async cancelSubscription(subscriptionId: string): Promise<Subscription>
  async handleWebhook(payload: string, signature: string): Promise<void>
}
```

#### PayPal Integration (Future)
```typescript
// src/lib/payments/paypal/
PayPalService/
├── PayPalClient.ts        // PayPal API client
├── SubscriptionManager.ts // PayPal subscription handling
└── WebhookHandler.ts      // PayPal webhook processing

// Abstract payment provider interface
interface PaymentProvider {
  createSubscription(params: CreateSubscriptionParams): Promise<Subscription>
  updateSubscription(params: UpdateSubscriptionParams): Promise<Subscription>
  cancelSubscription(subscriptionId: string): Promise<Subscription>
  processWebhook(payload: any): Promise<void>
}
```

### Notification System Integration

#### Email Service Integration
```typescript
// src/lib/notifications/email/
EmailService/
├── EmailProvider.ts       // Abstract email provider
├── SendGridProvider.ts    // SendGrid implementation
├── MailgunProvider.ts     // Mailgun implementation
├── TemplateManager.ts     // Email template management
└── DeliveryTracker.ts     // Email delivery tracking

interface EmailProvider {
  sendEmail(params: SendEmailParams): Promise<EmailResult>
  sendBulkEmail(params: SendBulkEmailParams): Promise<BulkEmailResult>
  getDeliveryStatus(messageId: string): Promise<DeliveryStatus>
}
```

#### SMS Service Integration
```typescript
// src/lib/notifications/sms/
SMSService/
├── SMSProvider.ts         // Abstract SMS provider
├── TwilioProvider.ts      // Twilio implementation
├── MessageManager.ts      // SMS message management
└── DeliveryTracker.ts     // SMS delivery tracking

interface SMSProvider {
  sendSMS(params: SendSMSParams): Promise<SMSResult>
  sendBulkSMS(params: SendBulkSMSParams): Promise<BulkSMSResult>
  getDeliveryStatus(messageId: string): Promise<DeliveryStatus>
}
```

## Security Architecture

### Authentication and Authorization

#### Enhanced RBAC System
```typescript
// src/lib/auth/rbac/
RBACSystem/
├── PermissionManager.ts   // Permission management
├── RoleManager.ts         // Role management
├── PolicyEngine.ts        // Policy evaluation
├── AccessControl.ts       // Access control middleware
└── AuditLogger.ts         // Security audit logging

interface Permission {
  resource: string
  action: string
  conditions?: PolicyCondition[]
}

interface Role {
  id: string
  name: string
  permissions: Permission[]
  inherits?: Role[]
}

class PolicyEngine {
  evaluate(user: User, resource: string, action: string, context?: any): Promise<boolean>
  evaluateBulk(user: User, permissions: Permission[], context?: any): Promise<boolean[]>
}
```

#### Session Management
```typescript
// src/lib/auth/session/
SessionManager/
├── SessionStore.ts        // Session storage
├── SessionValidator.ts    // Session validation
├── SecurityMonitor.ts     // Security monitoring
└── TokenManager.ts        // JWT token management

interface SessionConfig {
  maxAge: number
  rolling: boolean
  secure: boolean
  sameSite: 'strict' | 'lax' | 'none'
}

class SessionManager {
  createSession(user: User): Promise<Session>
  validateSession(sessionId: string): Promise<Session | null>
  refreshSession(sessionId: string): Promise<Session>
  destroySession(sessionId: string): Promise<void>
}
```

### Data Protection

#### Encryption Service
```typescript
// src/lib/security/encryption/
EncryptionService/
├── DataEncryption.ts      // Data encryption/decryption
├── KeyManager.ts          // Encryption key management
├── HashingService.ts      // Password hashing
└── TokenGenerator.ts      // Secure token generation

class DataEncryption {
  encrypt(data: string, key?: string): Promise<string>
  decrypt(encryptedData: string, key?: string): Promise<string>
  encryptObject(obj: any): Promise<string>
  decryptObject(encryptedData: string): Promise<any>
}
```

## Performance Architecture

### Caching Strategy

#### Multi-Level Caching
```typescript
// src/lib/cache/
CacheSystem/
├── CacheManager.ts        // Cache management
├── RedisCache.ts          // Redis cache implementation
├── MemoryCache.ts         // In-memory cache
├── CacheInvalidation.ts   // Cache invalidation
└── CacheMetrics.ts        // Cache performance metrics

interface CacheConfig {
  defaultTTL: number
  maxMemoryUsage: number
  evictionPolicy: 'lru' | 'lfu' | 'fifo'
  compression: boolean
}

class CacheManager {
  get<T>(key: string): Promise<T | null>
  set<T>(key: string, value: T, ttl?: number): Promise<void>
  invalidate(pattern: string): Promise<void>
  getStats(): Promise<CacheStats>
}
```

### Database Optimization

#### Query Optimization
```typescript
// src/lib/database/optimization/
DatabaseOptimization/
├── QueryOptimizer.ts      // Query optimization
├── IndexManager.ts        // Index management
├── ConnectionPool.ts      // Connection pooling
└── PerformanceMonitor.ts  // Database performance monitoring

class QueryOptimizer {
  optimizeQuery(query: string): string
  analyzePerformance(query: string): Promise<QueryAnalysis>
  suggestIndexes(table: string): Promise<IndexSuggestion[]>
}
```

## Monitoring and Observability

### Application Monitoring
```typescript
// src/lib/monitoring/
MonitoringSystem/
├── MetricsCollector.ts    // Metrics collection
├── PerformanceTracker.ts  // Performance tracking
├── ErrorTracker.ts        // Error tracking and reporting
├── HealthChecker.ts       // Health check system
└── AlertManager.ts        // Alert management

interface MetricsConfig {
  collectInterval: number
  retentionPeriod: number
  alertThresholds: AlertThreshold[]
}

class MetricsCollector {
  collectSystemMetrics(): Promise<SystemMetrics>
  collectApplicationMetrics(): Promise<ApplicationMetrics>
  collectBusinessMetrics(): Promise<BusinessMetrics>
}
```

This design provides a comprehensive foundation for implementing all the required functionality while maintaining clean architecture principles and ensuring scalability, security, and performance.