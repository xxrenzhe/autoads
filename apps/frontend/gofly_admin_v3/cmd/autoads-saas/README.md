# AutoAds SaaS - 集成GoFly成熟功能模块

AutoAds SaaS是一个基于GoFly Admin框架构建的企业级SaaS平台，集成了多个成熟的功能模块，提供完整的广告自动化管理解决方案。

## 🚀 集成的成熟功能模块

### 1. 邮件系统 (Email System)
- **功能特性**：
  - 用户注册欢迎邮件
  - 套餐到期提醒邮件
  - Token不足通知邮件
  - 任务完成通知邮件
  - 邀请奖励通知邮件
  - 安全提醒邮件
  - 支持HTML和文本格式
  - 模板化邮件系统
  - SMTP配置支持

- **API端点**：
  - `POST /api/email/welcome` - 发送欢迎邮件
  - `POST /api/email/trial-expired` - 发送试用到期邮件
  - `POST /api/email/low-tokens` - 发送Token不足邮件
  - `GET /admin/email/templates` - 获取邮件模板列表
  - `POST /admin/email/test` - 发送测试邮件

### 2. 文件上传系统 (Upload System)
- **功能特性**：
  - 单文件和多文件上传
  - 用户头像上传
  - 自动缩略图生成
  - 文件类型验证
  - 文件大小限制
  - 安全文件存储
  - CDN支持
  - 文件管理界面

- **API端点**：
  - `POST /api/upload/single` - 单文件上传
  - `POST /api/upload/multiple` - 多文件上传
  - `POST /api/upload/avatar` - 头像上传
  - `GET /api/files/*filepath` - 文件服务
  - `GET /admin/upload/stats` - 上传统计
  - `POST /admin/upload/cleanup` - 文件清理

### 3. 审计日志系统 (Audit System)
- **功能特性**：
  - 完整的用户操作审计
  - 安全事件监控
  - 管理员操作记录
  - 异常活动检测
  - 合规报告生成
  - 风险IP识别
  - 数据访问追踪
  - 审计日志分析

- **API端点**：
  - `GET /api/audit/events` - 获取审计事件
  - `GET /api/audit/stats/:user_id` - 获取用户操作统计
  - `GET /admin/audit/security-events` - 获取安全事件
  - `GET /admin/audit/security-stats` - 获取安全统计
  - `GET /admin/audit/risky-ips` - 获取风险IP

### 4. 监控系统 (Metrics System)
- **功能特性**：
  - Prometheus指标收集
  - 健康检查端点
  - 业务指标监控
  - 系统性能监控
  - 自定义指标支持
  - 实时监控面板
  - 告警机制
  - 性能分析

- **API端点**：
  - `GET /health` - 健康检查
  - `GET /health/detail` - 详细健康检查
  - `GET /ready` - 准备就绪检查
  - `GET /live` - 存活检查
  - `GET /metrics` - Prometheus指标

### 5. API文档生成 (Documentation System)
- **功能特性**：
  - 自动生成Swagger文档
  - Redoc交互式文档
  - Postman集合导出
  - API规范管理
  - 文档版本控制
  - 在线API测试
  - 多格式导出
  - 开发者友好

- **API端点**：
  - `GET /api/docs/swagger.json` - Swagger JSON
  - `GET /api/docs/swagger` - Swagger UI
  - `GET /api/docs/redoc` - Redoc文档
  - `GET /api/docs/postman.json` - Postman集合

## 🎨 用户体验优化功能 (新增)

### 6. Excel导出系统 (Export System)
- **功能特性**：
  - 一键导出用户数据
  - 任务记录导出 (支持按类型筛选)
  - Token交易记录导出
  - SiteRank查询记录导出
  - 自动格式化和样式设置
  - 支持大数据量导出
  - 文件名自动生成
  - 多语言表头支持

- **API端点**：
  - `GET /api/export/user-data` - 导出用户数据
  - `GET /api/export/task-records` - 导出任务记录
  - `GET /api/export/token-transactions` - 导出Token交易记录
  - `GET /api/export/siterank-queries` - 导出SiteRank查询记录

### 7. 国际化系统 (Internationalization System)
- **功能特性**：
  - 支持中英文切换
  - 自动语言检测 (Accept-Language头)
  - 用户语言偏好保存
  - 动态语言切换
  - 模块化翻译文件
  - 可扩展多语言支持
  - 回退机制
  - 缓存优化

- **API端点**：
  - `GET /api/i18n/languages` - 获取支持的语言列表
  - `POST /api/i18n/set-language` - 设置用户语言偏好

- **支持的语言**：
  - 🇨🇳 简体中文 (zh-CN)
  - 🇺🇸 English (en-US)

### 8. 验证码系统 (Captcha System)
- **功能特性**：
  - 图片验证码生成
  - 邮箱验证码发送
  - 自定义验证码样式
  - 防机器人攻击
  - 验证码过期机制
  - 多种验证码类型
  - 安全性增强
  - 用户体验优化

- **API端点**：
  - `GET /api/captcha/image` - 获取图片验证码
  - `POST /api/captcha/email` - 发送邮箱验证码
  - `POST /api/captcha/verify` - 验证验证码

### 9. 数据字典系统 (Data Dictionary System)
- **功能特性**：
  - 套餐类型动态配置
  - 任务状态管理
  - 优先级配置
  - Token交易类型管理
  - 用户状态配置
  - 文件类型管理
  - 访问模式配置
  - 热更新支持

- **API端点**：
  - `GET /api/dictionary/categories` - 获取字典分类
  - `GET /api/dictionary/category/:category` - 获取指定分类字典项
  - `POST /api/dictionary/items` - 创建字典项 (管理员)
  - `PUT /api/dictionary/items/:id` - 更新字典项 (管理员)
  - `DELETE /api/dictionary/items/:id` - 删除字典项 (管理员)

### 10. 多媒体处理系统 (Media Processing System)
- **功能特性**：
  - 图片自动优化
  - 视频缩略图生成
  - 图片尺寸调整
  - 质量压缩
  - 格式转换
  - 批量处理
  - FFmpeg集成
  - 处理状态监控

- **API端点**：
  - `POST /api/media/upload` - 上传并处理媒体文件
  - `GET /api/media/info/:file_id` - 获取媒体文件信息

- **支持的格式**：
  - 图片: JPG, PNG, GIF, BMP, WebP
  - 视频: MP4, AVI, MOV, MKV

## 🏗️ 系统架构

```
┌─────────────────────────────────────────────────────────────┐
│                    AutoAds SaaS Platform                    │
├─────────────────────────────────────────────────────────────┤
│  Frontend (Next.js)  │  Backend (Go + Gin)  │  Database    │
├─────────────────────────────────────────────────────────────┤
│                     GoFly成熟功能模块                        │
├─────────────────┬─────────────────┬─────────────────────────┤
│   邮件系统       │   文件上传系统    │   审计日志系统           │
│   - SMTP支持     │   - 多文件上传    │   - 操作审计            │
│   - 模板系统     │   - 缩略图生成    │   - 安全监控            │
│   - 自动发送     │   - 类型验证      │   - 合规报告            │
├─────────────────┼─────────────────┼─────────────────────────┤
│   监控系统       │   API文档生成     │   管理员功能            │
│   - Prometheus   │   - Swagger      │   - 用户管理            │
│   - 健康检查     │   - Redoc        │   - 系统配置            │
│   - 业务指标     │   - Postman      │   - 数据分析            │
├─────────────────┴─────────────────┴─────────────────────────┤
│                   用户体验优化功能 (新增)                     │
├─────────────────┬─────────────────┬─────────────────────────┤
│   Excel导出系统  │   国际化系统      │   验证码系统            │
│   - 用户数据导出  │   - 中英文切换    │   - 图片验证码          │
│   - 任务记录导出  │   - 自动检测      │   - 邮箱验证码          │
│   - Token记录导出│   - 用户偏好      │   - 安全增强            │
├─────────────────┼─────────────────┼─────────────────────────┤
│   数据字典系统    │   多媒体处理      │   用户体验集成          │
│   - 动态配置     │   - 图片优化      │   - 统一中间件          │
│   - 热更新       │   - 视频缩略图    │   - 性能监控            │
│   - 分类管理     │   - 格式转换      │   - 兼容性保证          │
└─────────────────┴─────────────────┴─────────────────────────┘
```

## 🚀 快速开始

### 环境要求
- Go 1.23+
- Node.js 22+
- Docker (可选)
- PostgreSQL/MySQL (数据库)
- Redis (缓存)

### 本地开发

1. **克隆项目**
```bash
git clone <repository-url>
cd autoads
```

2. **安装依赖**
```bash
# Go依赖
cd gofly_admin_v3
go mod download

# Node.js依赖
cd ..
npm install
```

3. **配置环境**
```bash
# 复制配置文件
cp gofly_admin_v3/config.yaml.example gofly_admin_v3/config.yaml

# 编辑配置文件
vim gofly_admin_v3/config.yaml
```

4. **启动服务**
```bash
# 启动开发服务器
./scripts/start-autoads-saas.sh
```

### Docker部署

1. **构建镜像**
```bash
docker build -f Dockerfile.autoads-saas -t autoads-saas:latest .
```

2. **运行容器**
```bash
docker run -d \
  --name autoads-saas \
  -p 8888:8888 \
  -e DATABASE_URL="postgres://user:pass@host:5432/dbname" \
  -e REDIS_URL="redis://host:6379" \
  autoads-saas:latest
```

## 📊 监控和健康检查

### 健康检查端点
- **基础健康检查**: `GET /health`
- **详细健康检查**: `GET /health/detail`
- **准备就绪检查**: `GET /ready`
- **存活检查**: `GET /live`

### Prometheus指标
访问 `http://localhost:8888/metrics` 获取Prometheus格式的指标数据。

主要指标包括：
- HTTP请求统计
- 系统资源使用
- 业务指标（用户、任务、Token等）
- 错误率和响应时间

### 监控面板
推荐使用Grafana配合Prometheus进行监控可视化：

```yaml
# docker-compose.yml
version: '3.8'
services:
  autoads-saas:
    image: autoads-saas:latest
    ports:
      - "8888:8888"
  
  prometheus:
    image: prom/prometheus
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
  
  grafana:
    image: grafana/grafana
    ports:
      - "3000:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
```

## 📚 API文档

### 在线文档
- **Swagger UI**: `http://localhost:8888/api/docs/swagger`
- **Redoc**: `http://localhost:8888/api/docs/redoc`

### 导出格式
- **Swagger JSON**: `http://localhost:8888/api/docs/swagger.json`
- **Postman集合**: `http://localhost:8888/api/docs/postman.json`

### API认证
大部分API需要认证，请在请求头中包含：
```
Authorization: Bearer <your-token>
```

## 🔧 配置说明

### 邮件配置
```yaml
email:
  host: smtp.gmail.com
  port: 587
  username: your-email@gmail.com
  password: your-app-password
  from: noreply@yourdomain.com
  use_tls: true
```

### 文件上传配置
```yaml
upload:
  upload_path: ./uploads
  max_size: 10485760  # 10MB
  allowed_types:
    image: true
    document: true
  enable_thumbnail: true
  thumb_width: 200
  thumb_height: 200
```

### 审计配置
```yaml
audit:
  retention_days: 90
  security_retention_days: 365
  enable_security_monitoring: true
  risk_threshold: 10
```

### 用户体验功能配置 (新增)
```yaml
# 国际化配置
i18n:
  default_language: zh-CN
  supported_languages:
    - zh-CN
    - en-US
  cache_duration: 30m

# 验证码配置
captcha:
  image_width: 120
  image_height: 40
  code_length: 4
  expire_time: 5m
  noise_count: 50

# 导出配置
export:
  max_records: 10000
  timeout: 30s
  temp_dir: ./temp

# 媒体处理配置
media:
  enable_video_thumbnail: true
  enable_image_optimize: true
  video_thumbnail_time: "00:00:01"
  image_quality: 85
  max_image_width: 1920
  max_image_height: 1080

# 数据字典配置
dictionary:
  cache_duration: 30m
  enable_hot_reload: true
```

## 🧪 测试

### 运行测试
```bash
# 单元测试
go test ./...

# 集成测试
go test -tags=integration ./cmd/autoads-saas/

# 性能测试
go test -bench=. ./cmd/autoads-saas/
```

### 测试覆盖率
```bash
go test -coverprofile=coverage.out ./...
go tool cover -html=coverage.out
```

## 📈 性能优化

### 缓存策略
- Redis缓存热点数据
- 文件上传缓存
- API响应缓存
- 数据库查询缓存

### 数据库优化
- 索引优化
- 查询优化
- 连接池配置
- 读写分离

### 文件存储优化
- CDN加速
- 图片压缩
- 缓存策略
- 清理机制

## 🔒 安全特性

### 安全措施
- HTTPS强制
- CORS配置
- 安全头设置
- 输入验证
- SQL注入防护
- XSS防护

### 审计和监控
- 操作审计
- 安全事件监控
- 异常检测
- 访问日志
- 错误追踪

## 🚀 部署指南

### 生产环境部署

1. **环境准备**
```bash
# 创建部署目录
mkdir -p /opt/autoads-saas
cd /opt/autoads-saas

# 下载部署脚本
curl -O https://raw.githubusercontent.com/your-repo/autoads/main/scripts/deploy-autoads-saas.sh
chmod +x deploy-autoads-saas.sh
```

2. **配置文件**
```bash
# 创建生产配置
cp config.yaml.example config.prod.yaml
vim config.prod.yaml
```

3. **部署执行**
```bash
# 执行部署
./deploy-autoads-saas.sh prod
```

### Kubernetes部署
```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: autoads-saas
spec:
  replicas: 3
  selector:
    matchLabels:
      app: autoads-saas
  template:
    metadata:
      labels:
        app: autoads-saas
    spec:
      containers:
      - name: autoads-saas
        image: autoads-saas:latest
        ports:
        - containerPort: 8888
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: autoads-secrets
              key: database-url
        livenessProbe:
          httpGet:
            path: /live
            port: 8888
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 8888
          initialDelaySeconds: 5
          periodSeconds: 5
```

## 🤝 贡献指南

### 开发流程
1. Fork项目
2. 创建功能分支
3. 提交代码
4. 创建Pull Request

### 代码规范
- 遵循Go代码规范
- 添加单元测试
- 更新文档
- 通过CI检查

## 📄 许可证

本项目采用MIT许可证，详见[LICENSE](LICENSE)文件。

## 📞 支持

- **文档**: [https://docs.autoads.com](https://docs.autoads.com)
- **问题反馈**: [GitHub Issues](https://github.com/your-repo/autoads/issues)
- **邮件支持**: support@autoads.com
- **社区讨论**: [Discord](https://discord.gg/autoads)

---

**AutoAds SaaS** - 基于GoFly成熟功能模块构建的企业级广告自动化管理平台 🚀