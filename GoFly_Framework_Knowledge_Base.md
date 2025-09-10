# GoFly Framework Knowledge Base for AutoAds Integration

## Overview

GoFly is a comprehensive Go-based web framework designed for enterprise-level applications with built-in admin management, RBAC permissions, and rapid development capabilities. This knowledge base is derived from the GoFly Admin V3 implementation found in the AutoAds project.

## Framework Architecture

### Core Components

1. **Router System** (`/utils/router/router.go`)
   - Gin-based HTTP router with automatic route registration
   - Built-in middleware support (CORS, rate limiting, JWT authentication)
   - Graceful shutdown and restart capabilities
   - PProf integration for performance monitoring

2. **Controller Structure** (`/app/`)
   - **Admin Module** (`/app/admin/`) - Administrative backend
   - **Business Module** (`/app/business/`) - Business logic backend
   - **Common Module** (`/app/common/`) - Shared functionality

3. **Utility Framework** (`/utils/gf/`)
   - Database ORM with connection pooling
   - Authentication and authorization
   - File upload and management
   - Caching system
   - Email services
   - Configuration management

### Key Features

#### 1. Automatic Route Registration
- Convention-based routing: `/{module}/{controller}/{action}`
- HTTP method inference from action names (Get*, Post*, Put*, Del*)
- Custom route support via `CustomRoutes` field
- Automatic parameter binding and validation

#### 2. Built-in RBAC System
- Role-based access control with hierarchical permissions
- Menu and button-level permission control
- Data access permissions (self, self+subordinates, all)
- Dynamic permission assignment and checking

#### 3. Multi-tenant Architecture
- Separate admin and business modules
- Independent permission systems for each module
- Shared core utilities and database connections

## Admin Module Functionality

### Core Administrative Features

#### 1. Account Management (`/app/admin/system/account.go`)
- User account CRUD operations
- Role assignment and management
- Department-based organization
- Status management and password handling
- Avatar and profile management

**Key Features:**
- Password encryption with salt
- Multi-role assignment per user
- Data permission filtering
- Account existence validation

#### 2. Role Management (`/app/admin/system/role.go`)
- Hierarchical role structure
- Permission assignment to roles
- Role inheritance and data access control
- Role status management

**Key Features:**
- Tree-structured role hierarchy
- Menu and button permission assignment
- Data access level configuration
- Super admin role with wildcard permissions

#### 3. Permission/Rule Management (`/app/admin/system/rule.go`)
- Menu management with tree structure
- Button-level permissions
- Route-based permission assignment
- Permission status management

**Key Features:**
- Three-level permission hierarchy (menus, sub-menus, buttons)
- Automatic route discovery and assignment
- Multi-language support for menu titles
- Icon and component mapping

### Business Module Functionality

#### 1. User Management (`/app/business/user/`)
- End-user account management
- Subscription and billing integration
- User settings and preferences

#### 2. Dashboard (`/app/business/dashboard/`)
- Business metrics and analytics
- Real-time data visualization
- Performance monitoring

#### 3. Data Center (`/app/business/datacenter/`)
- Business data management
- Reporting and analytics
- Data export capabilities

## RBAC Permission System

### Permission Structure

#### 1. Three-Level Hierarchy
- **Level 0**: Main menus (type = 0)
- **Level 1**: Sub-menus (type = 1)  
- **Level 2**: Button permissions (type = 2)

#### 2. Permission Types
- **Menu Permissions**: Access to UI sections
- **Button Permissions**: Action-specific permissions
- **Data Permissions**: Data access scope control

#### 3. Data Access Levels
- **Level 0**: Self-only data access
- **Level 1**: Self + subordinates data access
- **Level 2**: Full data access

### Permission Checking Logic

The framework implements a sophisticated permission checking system:

```go
// Check if user has permission for specific action
func CheckAuth(c *GinCtx, modelname string) bool {
    // 1. Get user roles
    role_id := Model(modelname+"_auth_role_access").Where("uid", userID).Array("role_id")
    
    // 2. Check for super admin role
    super_role := Model(modelname+"_auth_role").WhereIn("id", role_id).Where("rules", "*").Count()
    
    // 3. Super admin has all permissions
    if super_role != 0 {
        return true
    }
    
    // 4. Check specific permissions for regular roles
    menu_ids := Model(modelname+"_auth_role").WhereIn("id", role_id).Array("rules")
    hasPermission := Model(modelname+"_auth_rule").Where("status", 0).Where("type", 2).WhereIn("id", menu_ids).Where("path", c.FullPath()).Count()
    
    return hasPermission != 0
}
```

## Database Integration Patterns

### Database Configuration

#### 1. Primary Configuration (`/resource/config.yaml`)
```yaml
database:
  default:
    hostname: 127.0.0.1
    hostport: 3306
    username: root
    password: root
    dbname: gofly_admin_v3
    type: "mysql"
    charset: "utf8mb4"
    maxIdle: 10
    maxOpen: 100
    maxLifetime: "30s"
```

#### 2. Connection Pooling
- Configurable connection limits
- Automatic connection management
- Connection lifetime control
- SQL query logging and debugging

### ORM Features

#### 1. Model Operations
```go
// Basic CRUD operations
Model("table_name").Where("id", 1).Find()
Model("table_name").Data(data).Insert()
Model("table_name").Where("id", 1).Data(data).Update()
Model("table_name").WhereIn("id", ids).Delete()

// Pagination
Model("table_name").Page(pageNo, pageSize).Order("id desc").Select()

// Complex queries with conditions
whereMap := gmap.New()
whereMap.Set("status", 1)
whereMap.Set("name like ?", "%search%")
Model("table_name").Where(whereMap).Select()
```

#### 2. Automatic Field Management
- Auto timestamp fields (`createtime`, `updatetime`)
- Soft delete support (`deletetime`)
- Field type conversion and validation
- Transaction support

### Database Schema Patterns

#### 1. Admin System Tables
- `admin_auth_rule` - Permission rules
- `admin_auth_role` - Role definitions
- `admin_auth_role_access` - User-role assignments
- `admin_auth_dept` - Department structure
- `admin_account` - Admin user accounts

#### 2. Business System Tables
- `business_auth_rule` - Business permissions
- `business_auth_role` - Business roles
- `business_auth_role_access` - Business user-role mappings
- `business_user` - End-user accounts

## API Structure and Endpoints

### Route Convention

#### 1. Automatic Route Generation
- Pattern: `/{module}/{controller}/{action}`
- HTTP methods inferred from action names:
  - `Get*` → GET
  - `Post*` → POST
  - `Put*` → PUT
  - `Del*` → DELETE

#### 2. Standard Endpoints
```
# Admin Module
/admin/account/getList          - Get account list
/admin/account/save             - Create/update account
/admin/account/upStatus         - Update account status
/admin/account/del              - Delete accounts
/admin/account/getContent       - Get account details

/admin/role/getList             - Get role list
/admin/role/save                - Create/update role
/admin/role/getMenuList         - Get role menu permissions

/admin/rule/getList             - Get permission rules
/admin/rule/save                - Create/update permission
/admin/rule/getRoutes           - Get available routes

# Business Module  
/business/user/getList          - Get user list
/business/dashboard/getStats    - Get dashboard statistics
/business/datacenter/getData    - Get business data
```

### Response Format

#### 1. Standard Response Structure
```json
{
  "code": 200,
  "message": "Success message",
  "data": {
    "items": [],
    "total": 100,
    "page": 1,
    "pageSize": 10
  }
}
```

#### 2. Error Response
```json
{
  "code": 400,
  "message": "Error message",
  "data": null
}
```

## Configuration Options

### Application Configuration

#### 1. Core Settings (`/resource/config.yaml`)
```yaml
app:
  version: 3.0.0
  port: 8200
  apisecret: gofly@888          # API secret key
  tokensecret: gf849841325189456f489  # JWT secret
  allowurl: "http://localhost:9200,http://localhost:9201"
  apiouttime: 180               # API timeout (seconds)
  tokenouttime: 120            # JWT timeout (minutes)
  loginCaptcha: true           # Enable login captcha
  runEnv: debug                # Environment (debug/release/test)
```

#### 2. Security Configuration
- JWT token management
- API request validation
- CORS configuration
- Rate limiting settings
- Login captcha support

#### 3. Performance Configuration
- CPU core utilization
- Memory management
- Connection pooling
- Caching configuration

### Redis Configuration

```yaml
redis:
  default:
    address: 127.0.0.1:6379
    db: 1
  cache:
    address: 127.0.0.1:6379
    db: 1
    pass: "123456"
    idleTimeout: 600
```

## Best Practices and Conventions

### Code Organization

#### 1. Controller Structure
```go
type ControllerName struct {
    NoNeedLogin []string  // Methods that don't require login
    NoNeedAuths []string  // Methods that don't require permission checks
    CustomRoutes map[string]string  // Custom route mappings
}

func init() {
    controller := ControllerName{
        NoNeedLogin: []string{"GetLogin", "PostLogin"},
        NoNeedAuths: []string{"GetInfo"},
    }
    gf.Register(&controller, controller)
}
```

#### 2. Action Naming Conventions
- `GetList` - Retrieve list data
- `GetContent` - Retrieve single item
- `Save` - Create or update
- `UpStatus` - Update status
- `Del` - Delete items
- `GetParent` - Get parent/selection data

### Database Best Practices

#### 1. Table Naming
- Admin tables: `admin_*`
- Business tables: `business_*`
- Common tables: `common_*`
- Use snake_case naming

#### 2. Field Conventions
- `id` - Primary key
- `pid` - Parent ID for hierarchical data
- `status` - Record status (0=active, 1=inactive)
- `createtime` - Creation timestamp
- `updatetime` - Update timestamp
- `deletetime` - Soft delete timestamp

### Security Best Practices

#### 1. Authentication
- JWT token validation
- Password encryption with salt
- Login attempt limiting
- Session management

#### 2. Authorization
- Route-level permission checking
- Data access filtering
- Role-based menu visibility
- API endpoint protection

#### 3. Data Validation
- Input parameter validation
- SQL injection prevention
- XSS protection
- CSRF protection

## Integration with AutoAds

### Integration Points

#### 1. User Management Integration
- Map AutoAds user roles to GoFly business roles
- Synchronize user accounts between systems
- Implement single sign-on (SSO) capabilities

#### 2. Permission Integration
- Extend GoFly RBAC for AutoAds features
- Create AutoAds-specific permission rules
- Implement feature-based access control

#### 3. API Integration
- Expose AutoAds functionality through GoFly API
- Implement API rate limiting for AutoAds features
- Create unified API documentation

#### 4. Database Integration
- Share database connections and pooling
- Implement cross-system data consistency
- Create unified transaction management

### Migration Strategy

#### 1. Phase 1: Admin System Integration
- Implement GoFly admin panel for AutoAds management
- Migrate existing admin functionality to GoFly
- Establish role-based access for admin users

#### 2. Phase 2: Business Logic Integration
- Integrate AutoAds business features with GoFly business module
- Implement user-facing functionality through GoFly
- Create unified user experience

#### 3. Phase 3: Advanced Features
- Implement advanced RBAC for AutoAds features
- Add analytics and reporting capabilities
- Implement multi-tenant architecture

### Recommended Implementation Steps

1. **Setup GoFly Framework**
   - Install and configure GoFly in AutoAds project
   - Set up database connections and migrations
   - Configure Redis for caching

2. **Implement Core Admin Features**
   - Create admin user accounts and roles
   - Set up basic permission structure
   - Implement user management interfaces

3. **Integrate AutoAds Features**
   - Map AutoAds entities to GoFly models
   - Create API endpoints for AutoAds functionality
   - Implement business logic controllers

4. **Extend RBAC System**
   - Define AutoAds-specific permissions
   - Create role hierarchies for different user types
   - Implement data access controls

5. **Testing and Deployment**
   - Test integration thoroughly
   - Implement monitoring and logging
   - Deploy to production environment

## Conclusion

The GoFly framework provides a robust foundation for building enterprise-level web applications with comprehensive admin management, sophisticated RBAC permissions, and rapid development capabilities. Its modular architecture and convention-based approach make it an excellent choice for extending the AutoAds SaaS platform with advanced administrative features and business logic.

Key advantages for AutoAds integration:
- **Rapid Development**: Automatic route generation and CRUD operations
- **Scalable Architecture**: Multi-tenant design with independent modules
- **Comprehensive Security**: Built-in authentication and authorization
- **Flexible Permissions**: Sophisticated RBAC system with data access control
- **Enterprise Features**: Logging, monitoring, and performance optimization

By following the integration patterns and best practices outlined in this knowledge base, the AutoAds team can successfully leverage the GoFly framework to enhance their platform with advanced administrative capabilities and scalable business logic.