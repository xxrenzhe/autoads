# AutoAds GoFly Admin V3 - 现代化后台管理系统

## 项目概述

AutoAds GoFly Admin V3 是一个基于 GoFly 框架开发的现代化后台管理系统，支持单体应用 + 模块化设计。系统已经完成了全面的优化和改进，提供了完善的认证、授权、API管理等功能。

## 最新特性 ✨

### 1. 认证系统优化
- **JWT Token 实现** - 支持自动过期和刷新
- **双认证支持** - Basic Auth + Bearer Token
- **Google OAuth 集成** - 完整的 OAuth2 登录流程

### 2. 请求验证和错误处理
- **统一验证中间件** - JSON、查询参数、路径参数验证
- **标准化错误响应** - 详细的错误信息和开发支持

### 3. 中间件系统
- **CORS 中间件** - 跨域访问支持
- **日志中间件** - 请求/响应记录
- **限流中间件** - IP 限流和自动清理
- **错误处理中间件** - Panic 恢复和错误记录

### 4. 配置管理
- **热重载配置** - 监控文件变更，自动重新加载
- **优化连接池** - 高性能数据库连接配置

### 5. API 文档
- **Swagger 集成** - 自动生成 API 文档

## 快速开始

### 1. 环境要求

- Go 1.18+
- MySQL 5.7+
- Redis (可选)

### 2. 热加载开发

```bash
# 安装 fresh 热加载工具
go install github.com/pilu/fresh@latest

# 初始化依赖
go mod tidy

# 启动热加载
fresh
```

### 3. 配置文件

编辑 `resource/config.yaml`：

```yaml
database:
  default:
    hostname: 127.0.0.1
    hostport: 3306
    username: root
    password: root
    dbname: autoads_gofly
    
oauth:
  google:
    client_id: "your-google-client-id"
    client_secret: "your-google-secret"
    redirect_url: "http://localhost:8080/api/v1/user/google/callback"
```

### 4. 启动服务

```bash
# 使用启动脚本
./scripts/start.sh

# 或直接运行
go run main.go
```

### 5. 测试 API

```bash
# 综合测试
./scripts/test-comprehensive.sh

# 验证测试
./scripts/test-validation.sh
```

### 6. 访问服务

- API 服务: http://localhost:8080
- Swagger 文档: http://localhost:8080/swagger/index.html
- 健康检查: http://localhost:8080/health

## 项目结构

```
gofly_admin_v3/
├── internal/
│   ├── app/              # 应用路由
│   ├── admin/            # 管理员模块
│   ├── auth/             # 认证服务
│   ├── config/           # 配置管理
│   ├── middleware/       # 中间件
│   ├── models/           # 数据模型
│   └── user/             # 用户模块
├── resource/
│   └── config.yaml       # 配置文件
├── scripts/              # 脚本文件
├── docs/                 # 文档
└── main.go               # 主程序入口
```

## 主要 API 端点

### 用户认证
- `POST /api/v1/user/register` - 用户注册
- `POST /api/v1/user/login` - 用户登录
- `GET /api/v1/user/profile` - 获取用户信息
- `PUT /api/v1/user/profile` - 更新用户信息
- `POST /api/v1/user/change-password` - 修改密码
- `POST /api/v1/user/refresh-token` - 刷新 token
- `POST /api/v1/user/logout` - 用户登出
- `GET /api/v1/user/google/callback` - Google OAuth 回调

### 管理员认证
- `POST /api/v1/admin/login` - 管理员登录
- `GET /api/v1/admin/dashboard` - 仪表板
- `GET /api/v1/admin/users` - 用户列表
- `GET /api/v1/admin/users/:id` - 用户详情
- `PUT /api/v1/admin/users/:id/status` - 更新用户状态

## 打包部署

### Windows 系统

```bash
# Windows 打包
go build main.go

# 打包为 Linux 程序
SET GOOS=linux
SET GOARCH=amd64
go build
```

### Mac/Linux 系统

```bash
# 打包为 Linux 程序
CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build main.go
```

### Docker 部署

```bash
# 构建镜像
docker build -t autoads-gofly .

# 运行容器
docker run -p 8080:8080 autoads-gofly
```

## 性能优化

系统已包含以下优化：

1. **数据库连接池**
   - MaxIdle: 20
   - MaxOpen: 200
   - MaxLifetime: 1小时

2. **限流保护**
   - 未认证用户: 100次/分钟
   - 认证用户: 300次/分钟

3. **缓存支持**
   - JWT Token 缓存
   - Redis 缓存配置

4. **监控支持**
   - 结构化日志
   - 性能分析接口

## 开发指南

### 添加新 API

1. 在对应的 controller 中添加方法
2. 在 `internal/app/routes.go` 中添加路由
3. 在 `internal/models/request.go` 中添加验证模型
4. 更新 Swagger 注释

### 添加中间件

1. 在 `internal/middleware/` 目录创建文件
2. 实现 `gin.HandlerFunc` 接口
3. 在路由中应用中间件

### 配置修改

配置文件支持热重载，修改后自动生效。

## 常见问题

### Q: 如何配置跨域？
A: 在 `config.yaml` 中修改 `allowurl` 配置。

### Q: 如何启用调试模式？
A: 设置 `runEnv: debug` 并启用 `runpprof: true`。

### Q: 如何添加新的认证方式？
A: 在 `internal/middleware/jwt.go` 中扩展认证逻辑。

## 贡献指南

1. Fork 项目
2. 创建特性分支
3. 提交变更
4. 发起 Pull Request

## 许可证

Apache License 2.0