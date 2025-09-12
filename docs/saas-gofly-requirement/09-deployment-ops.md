# 部署和运维指南

## 1. 部署架构

### 1.1 整体架构图

```
[用户访问]
    ↓
[301跳转] autoads.dev → www.autoads.dev
    ↓
[ClawCloud容器服务]
    ├── Go + Next.js 单进程 (端口3000)
    │   ├── Go HTTP服务器 (内置路由)
    │   ├── Next.js静态文件 (内置服务)
    │   └── 统一进程管理
    └── MySQL/Redis外部服务
```

### 1.2 部署模式

**Linus式简化部署**：单进程，无复杂组件
- 预发/生产环境：2C4G容器
- 单进程部署：Go主进程 + Next.js嵌入
- 外部数据库：MySQL托管服务
- 外部缓存：Redis托管服务（仅用于Session）

## 2. 容器化部署

### 2.1 Dockerfile.simple

Linus式单进程部署，Go主进程嵌入Next.js：

```dockerfile
# 构建阶段
FROM golang:1.21-alpine AS builder

# 安装Node.js（用于构建Next.js）
RUN apk add --no-cache nodejs npm git

# 设置工作目录
WORKDIR /app

# 复制依赖文件
COPY go.mod go.sum ./
COPY package*.json ./

# 下载依赖
RUN go mod download
RUN npm ci

# 复制源代码
COPY . .

# 构建Next.js
RUN npm run build

# 构建Go应用（嵌入Next.js）
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o autoads-server .

# 运行阶段
FROM alpine:latest

# 安装ca-certificates和时区数据
RUN apk --no-cache add ca-certificates tzdata

# 设置时区
RUN cp /usr/share/zoneinfo/Asia/Shanghai /etc/localtime && \
    echo "Asia/Shanghai" > /etc/timezone

# 创建应用用户
RUN addgroup -g 1000 appgroup && \
    adduser -u 1000 -G appgroup -s /bin/sh -D appuser

# 设置工作目录
WORKDIR /app

# 从构建阶段复制二进制文件
COPY --from=builder --chown=appuser:appgroup /app/autoads-server ./autoads-server

# 复制Next.js构建产物
COPY --from=builder --chown=appuser:appgroup /app/.next/standalone ./
COPY --from=builder --chown=appuser:appgroup /app/public ./public

# 创建日志目录
RUN mkdir -p logs && chown -R appuser:appgroup /app/logs

# 切换到非root用户
USER appuser

# 暴露端口
EXPOSE 3000

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=30s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

# 启动命令（单进程）
CMD ["./autoads-server"]
```

### 2.2 Docker Compose（简化版）

```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DB_HOST=mysql
      - DB_PORT=3306
      - DB_USER=root
      - DB_PASSWORD=123456
      - DB_NAME=autoads
      - REDIS_HOST=redis
      - REDIS_PORT=6379
      - GOOGLE_CLIENT_ID=your-google-client-id
      - GOOGLE_CLIENT_SECRET=your-google-client-secret
      - APP_ENV=production
    depends_on:
      - mysql
      - redis
    volumes:
      - ./logs:/app/logs
    networks:
      - app-network
    restart: unless-stopped

  mysql:
    image: mysql:8.0
    ports:
      - "3306:3306"
    environment:
      - MYSQL_ROOT_PASSWORD=123456
      - MYSQL_DATABASE=autoads
    volumes:
      - mysql-data:/var/lib/mysql
    networks:
      - app-network
    restart: unless-stopped

  redis:
    image: redis:7.0-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
    networks:
      - app-network
    restart: unless-stopped

volumes:
  mysql-data:
  redis-data:

networks:
  app-network:
    driver: bridge
```

## 3. GitHub Actions CI/CD

### 3.1 部署流程

基于现有部署流程，配置 GitHub Actions 自动构建镜像：

**镜像标签规则**
- `main` 分支 → `ghcr.io/xxrenzhe/autoads:preview-latest`
- `production` 分支 → `ghcr.io/xxrenzhe/autoads:prod-latest`
- `production` 分支打 tag → `ghcr.io/xxrenzhe/autoads:prod-[tag]`

### 3.2 GitHub Actions 配置

```yaml
# .github/workflows/docker.yml
name: Build and Push Docker Image

on:
  push:
    branches: [ main, production ]
    tags:
      - 'v*'

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: xxrenzhe/autoads

jobs:
  build-and-push:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write

    steps:
    - name: Checkout repository
      uses: actions/checkout@v4

    - name: Set up Docker Buildx
      uses: docker/setup-buildx-action@v3

    - name: Log in to Container Registry
      uses: docker/login-action@v3
      with:
        registry: ${{ env.REGISTRY }}
        username: ${{ github.actor }}
        password: ${{ secrets.GITHUB_TOKEN }}

    - name: Extract metadata
      id: meta
      uses: docker/metadata-action@v5
      with:
        images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
        tags: |
          type=ref,event=branch
          type=ref,event=pr
          type=semver,pattern={{version}}
          type=semver,pattern={{major}}.{{minor}}

    - name: Build and push Docker image
      uses: docker/build-push-action@v5
      with:
        context: .
        file: ./Dockerfile.simple
        push: true
        tags: ${{ steps.meta.outputs.tags }}
        labels: ${{ steps.meta.outputs.labels }}
        cache-from: type=gha
        cache-to: type=gha,mode=max
```

### 3.3 环境变量配置

**预发环境 (.env.preview)**
```env
# 基础配置
NODE_ENV=production
NEXT_PUBLIC_DOMAIN=urlchecker.dev
NEXT_PUBLIC_DEPLOYMENT_ENV=preview

# 数据库
DATABASE_URL=mysql://root:jtl85fn8@dbprovider.sg-members-1.clawcloudrun.com:30354

# Redis
REDIS_URL=redis://default:9xdjb8nf@dbprovider.sg-members-1.clawcloudrun.com:32284

# 认证
AUTH_SECRET=85674018a64071a1f65a376d45a522dec78495cae7f5f1516febf8a4d51ff834
AUTH_URL=https://www.urlchecker.dev
AUTH_GOOGLE_ID=1007142410985-4945m48srrp056kp0q5n0e5he8omrdol.apps.googleusercontent.com
AUTH_GOOGLE_SECRET=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

# GoFly 配置
GOFLY_PORT=8888
GOFLY_DB_URL=${DATABASE_URL}
GOFLY_REDIS_URL=${REDIS_URL}
GOFLY_JWT_SECRET=${AUTH_SECRET}
```

**生产环境 (.env.production)**
```env
# 基础配置
NODE_ENV=production
NEXT_PUBLIC_DOMAIN=autoads.dev
NEXT_PUBLIC_DEPLOYMENT_ENV=production

# 数据库（生产环境配置）
DATABASE_URL=${PROD_DATABASE_URL}

# Redis（生产环境配置）
REDIS_URL=${PROD_REDIS_URL}

# 认证
AUTH_SECRET=${PROD_AUTH_SECRET}
AUTH_URL=https://www.autoads.dev
AUTH_GOOGLE_ID=${PROD_AUTH_GOOGLE_ID}
AUTH_GOOGLE_SECRET=${PROD_AUTH_GOOGLE_SECRET}

# GoFly 配置
GOFLY_PORT=8888
GOFLY_DB_URL=${DATABASE_URL}
GOFLY_REDIS_URL=${REDIS_URL}
GOFLY_JWT_SECRET=${AUTH_SECRET}
```

## 4. CI/CD流水线

### 4.1 GitLab CI配置

```yaml
# .gitlab-ci.yml
stages:
  - test
  - build
  - deploy

variables:
  DOCKER_REGISTRY: registry.example.com
  DOCKER_IMAGE: $DOCKER_REGISTRY/autoads

# 测试阶段
test:
  stage: test
  image: golang:1.21-alpine
  script:
    - go mod download
    - go test -v ./...
    - go vet ./...
    - golangci-lint run
  coverage: '/^coverage:\s(\d+(?:\.\d+)?%)/'
  artifacts:
    reports:
      junit: test-report.xml
      coverage_report:
        coverage_format: cobertura
        path: coverage.xml

# 构建镜像
build:
  stage: build
  image: docker:latest
  services:
    - docker:dind
  script:
    - docker login -u $CI_REGISTRY_USER -p $CI_REGISTRY_PASSWORD $CI_REGISTRY
    - docker build -t $DOCKER_IMAGE:$CI_COMMIT_SHA .
    - docker push $DOCKER_IMAGE:$CI_COMMIT_SHA
    - docker tag $DOCKER_IMAGE:$CI_COMMIT_SHA $DOCKER_IMAGE:latest
    - docker push $DOCKER_IMAGE:latest
  only:
    - main
    - develop

# 部署到开发环境
deploy-dev:
  stage: deploy
  image: bitnami/kubectl:latest
  script:
    - kubectl config use-context dev-cluster
    - sed -i "s/IMAGE_TAG/$CI_COMMIT_SHA/g" k8s/overlays/dev/kustomization.yaml
    - kubectl apply -k k8s/overlays/dev
  environment:
    name: development
    url: https://dev-api.autoads.com
  only:
    - develop

# 部署到生产环境
deploy-prod:
  stage: deploy
  image: bitnami/kubectl:latest
  script:
    - kubectl config use-context prod-cluster
    - sed -i "s/IMAGE_TAG/$CI_COMMIT_SHA/g" k8s/overlays/prod/kustomization.yaml
    - kubectl apply -k k8s/overlays/prod
  environment:
    name: production
    url: https://api.autoads.com
  when: manual
  only:
    - main
```

### 4.2 Kustomize配置

**Base配置**
```yaml
# k8s/base/kustomization.yaml
resources:
- namespace.yaml
- configmap.yaml
- secret.yaml
- deployment.yaml
- service.yaml
- ingress.yaml

commonLabels:
  app: autoads
  version: v1
```

**开发环境覆盖**
```yaml
# k8s/overlays/dev/kustomization.yaml
bases:
- ../../base

patchesStrategicMerge:
- |-
  apiVersion: apps/v1
  kind: Deployment
  metadata:
    name: autoads-deployment
  spec:
    replicas: 1
    template:
      spec:
        containers:
        - name: autoads
          image: registry.example.com/autoads:IMAGE_TAG
          resources:
            requests:
              memory: "256Mi"
              cpu: "250m"
            limits:
              memory: "512Mi"
              cpu: "500m"
```

## 5. 监控和日志

### 5.1 Prometheus监控

```yaml
# prometheus-config.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: prometheus-config
  namespace: monitoring
data:
  prometheus.yml: |
    global:
      scrape_interval: 15s
      evaluation_interval: 15s
    
    scrape_configs:
    - job_name: 'autoads'
      kubernetes_sd_configs:
      - role: endpoints
        namespaces:
          names:
          - autoads
      relabel_configs:
      - source_labels: [__meta_kubernetes_service_annotation_prometheus_io_scrape]
        action: keep
        regex: true
      - source_labels: [__meta_kubernetes_service_annotation_prometheus_io_path]
        action: replace
        target_label: __metrics_path__
        regex: (.+)
      - source_labels: [__address__, __meta_kubernetes_service_annotation_prometheus_io_port]
        action: replace
        regex: ([^:]+)(?::\d+)?;(\d+)
        replacement: $1:$2
        target_label: __address__
```

### 5.2 Grafana仪表板

```json
{
  "dashboard": {
    "id": null,
    "title": "AutoAds Dashboard",
    "tags": ["autoads"],
    "timezone": "Asia/Shanghai",
    "panels": [
      {
        "id": 1,
        "title": "HTTP Requests",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(http_requests_total[5m])",
            "legendFormat": "{{method}} {{path}}"
          }
        ]
      },
      {
        "id": 2,
        "title": "Response Time",
        "type": "graph",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))",
            "legendFormat": "{{method}} {{path}}"
          }
        ]
      },
      {
        "id": 3,
        "title": "Database Connections",
        "type": "singlestat",
        "targets": [
          {
            "expr": "db_connections_active",
            "legendFormat": ""
          }
        ]
      }
    ]
  }
}
```

### 5.3 日志收集

**Filebeat配置**
```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: filebeat-config
  namespace: autoads
data:
  filebeat.yml: |
    filebeat.inputs:
    - type: log
      enabled: true
      paths:
        - /app/logs/*.log
      fields:
        app: autoads
        env: production
      fields_under_root: true
    
    output.elasticsearch:
      hosts: ["elasticsearch:9200"]
      indices:
        - index: "filebeat-%{[agent.version]}-%{+yyyy.MM.dd}"
    
    setup.template.enabled: false
```

### 5.4 告警规则

```yaml
groups:
- name: autoads-alerts
  rules:
  - alert: HighErrorRate
    expr: rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m]) > 0.05
    for: 5m
    labels:
      severity: critical
    annotations:
      summary: "High error rate detected"
      description: "Error rate is {{ $value }} for {{ $labels.instance }}"
  
  - alert: HighResponseTime
    expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 1
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: "High response time detected"
      description: "95th percentile response time is {{ $value }}s"
```

## 6. 数据库运维

### 6.1 数据备份策略

```bash
#!/bin/bash
# backup.sh

# 设置变量
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backup/mysql"
DB_NAME="autoads"
DB_USER="root"
DB_PASS="123456"
RETENTION_DAYS=30

# 创建备份目录
mkdir -p $BACKUP_DIR

# 执行备份
mysqldump -u$DB_USER -p$DB_PASS \
  --single-transaction \
  --routines \
  --triggers \
  --databases $DB_NAME | gzip > $BACKUP_DIR/$DB_NAME_$DATE.sql.gz

# 删除旧备份
find $BACKUP_DIR -name "*.sql.gz" -mtime +$RETENTION_DAYS -delete

# 记录日志
echo "Backup completed: $BACKUP_DIR/$DB_NAME_$DATE.sql.gz" >> /var/log/mysql-backup.log
```

### 6.2 数据库维护

```sql
-- 优化表
OPTIMIZE TABLE batch_tasks;
OPTIMIZE TABLE site_rank_queries;
OPTIMIZE TABLE token_transactions;

-- 更新统计信息
ANALYZE TABLE batch_tasks;
ANALYZE TABLE site_rank_queries;
ANALYZE TABLE token_transactions;

-- 检查表
CHECK TABLE batch_tasks;
CHECK TABLE site_rank_queries;
CHECK TABLE token_transactions;
```

### 6.3 数据恢复流程

```bash
#!/bin/bash
# restore.sh

# 设置变量
BACKUP_FILE=$1
DB_NAME="autoads"
DB_USER="root"
DB_PASS="123456"

# 检查备份文件
if [ ! -f "$BACKUP_FILE" ]; then
    echo "Backup file not found: $BACKUP_FILE"
    exit 1
fi

# 停止应用
kubectl scale deployment autoads-deployment --replicas=0

# 恢复数据
gunzip < $BACKUP_FILE | mysql -u$DB_USER -p$DB_PASS

# 启动应用
kubectl scale deployment autoads-deployment --replicas=3

echo "Restore completed from: $BACKUP_FILE"
```

## 7. 性能调优

### 7.1 Go应用优化

```go
// 设置GOMAXPROCS
runtime.GOMAXPROCS(runtime.NumCPU())

// 设置GC参数
debug.SetGCPercent(100)

// 连接池配置
db, err := gorm.Open(mysql.Open(dsn), &gorm.Config{
    PoolSize: 100,
    MaxIdleConns: 20,
    ConnMaxLifetime: time.Hour,
    ConnMaxIdleTime: 30 * time.Minute,
})

// HTTP服务器配置
srv := &http.Server{
    Addr:         ":8080",
    Handler:      router,
    ReadTimeout:  15 * time.Second,
    WriteTimeout: 15 * time.Second,
    IdleTimeout:  60 * time.Second,
}
```

## 8. 安全配置

### 8.1 容器安全

**运行时安全**
```dockerfile
# 安全增强的Dockerfile配置
FROM alpine:latest

# 安装安全更新
RUN apk add --no-cache ca-certificates tzdata && \
    apk update && \
    apk upgrade

# 创建专用的非root用户
RUN addgroup -g 1000 appgroup && \
    adduser -u 1000 -G appgroup -s /bin/sh -D appuser

# 限制文件权限
RUN chmod 700 /app && \
    chown -R appuser:appgroup /app

# 使用只读根文件系统（除了特定目录）
VOLUME ["/app/logs", "/tmp"]
```

**安全扫描**
```bash
# 使用Trivy进行漏洞扫描
trivy image --severity CRITICAL,HIGH your-image:tag

# 使用Snyk进行依赖检查
snyk test --docker your-image:tag
```

### 8.2 网络安全

**防火墙配置**
```bash
# 只开放必要端口
ufw allow 22/tcp    # SSH
ufw allow 443/tcp   # HTTPS
ufw allow 80/tcp    # HTTP（重定向到HTTPS）
ufw enable
```

**DDoS防护**
```nginx
# 限流配置
limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
limit_req zone=api burst=20 nodelay;

# 连接限制
limit_conn_zone $binary_remote_addr zone=conn:10m;
limit_conn conn 100;
```

### 8.3 数据安全

**加密存储**
```go
// 使用bcrypt存储密码
func HashPassword(password string) (string, error) {
    hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), 12)
    if err != nil {
        return "", err
    }
    return string(hashedPassword), nil
}

// JWT配置
jwtConfig := jwt.Config{
    SigningKey:   []byte(config.JWTSecret),
    SigningMethod: jwt.SigningMethodHS256.Name,
    Expiration:   time.Hour * 24,
}
```

**数据库安全**
```sql
-- 最小权限原则
CREATE USER 'autoads_app'@'%' IDENTIFIED BY 'strong_password';
GRANT SELECT, INSERT, UPDATE, DELETE ON autoads.* TO 'autoads_app'@'%';
GRANT EXECUTE ON PROCEDURE autoads.* TO 'autoads_app'@'%';

-- 定期更改密码
ALTER USER 'autoads_app'@'%' IDENTIFIED BY 'new_strong_password';
```

### 8.4 API安全

**请求验证**
```go
// 中间件：请求大小限制
func RequestSizeLimit(maxSize int64) gin.HandlerFunc {
    return func(c *gin.Context) {
        if c.Request.ContentLength > maxSize {
            c.AbortWithStatusJSON(413, gin.H{
                "code":    413,
                "message": "Request entity too large",
            })
            return
        }
        c.Next()
    }
}

// 中间件：CORS配置
func CORSMiddleware() gin.HandlerFunc {
    return func(c *gin.Context) {
        c.Header("Access-Control-Allow-Origin", "*")
        c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        c.Header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        
        if c.Request.Method == "OPTIONS" {
            c.AbortWithStatus(204)
            return
        }
        
        c.Next()
    }
}
```

**JWT安全**
```go
// Token验证中间件
func AuthMiddleware() gin.HandlerFunc {
    return func(c *gin.Context) {
        token := c.GetHeader("Authorization")
        if token == "" {
            c.AbortWithStatusJSON(401, gin.H{"code": 401, "message": "Missing token"})
            return
        }
        
        // 去掉Bearer前缀
        token = token[7:]
        
        // 验证Token
        claims, err := jwt.ParseToken(token)
        if err != nil {
            c.AbortWithStatusJSON(401, gin.H{"code": 401, "message": "Invalid token"})
            return
        }
        
        // 检查是否过期
        if claims.ExpiresAt.Before(time.Now()) {
            c.AbortWithStatusJSON(401, gin.H{"code": 401, "message": "Token expired"})
            return
        }
        
        c.Set("user_id", claims.UserID)
        c.Set("tenant_id", claims.TenantID)
        c.Next()
    }
}
```

### 8.5 密钥管理

**环境变量加密**
```bash
# 使用Vault管理密钥
vault kv put secret/autoads \
    db_password="secure_password" \
    jwt_secret="secure_jwt_secret" \
    api_key="secure_api_key"

# 应用启动时获取密钥
export DB_PASSWORD=$(vault kv get -field=db_password secret/autoads)
```

**密钥轮换策略**
```bash
# 每季度轮换JWT密钥
#!/bin/bash
NEW_SECRET=$(openssl rand -hex 32)
echo "New JWT secret generated"

# 更新Vault
vault kv patch secret/autoads jwt_secret="$NEW_SECRET"

# 通知运维团队
echo "JWT secret rotated at $(date)" | mail -s "JWT Secret Rotation" ops@example.com
```

### 8.6 监控和审计

**安全事件日志**
```go
// 记录安全事件
func LogSecurityEvent(eventType, userID, ipAddress string, details interface{}) {
    logEntry := map[string]interface{}{
        "timestamp":   time.Now(),
        "event_type":  eventType,
        "user_id":     userID,
        "ip_address":  ipAddress,
        "details":     details,
    }
    
    log.Printf("SECURITY_EVENT: %v", logEntry)
}

// 使用示例
LogSecurityEvent("LOGIN_SUCCESS", user.ID, clientIP, map[string]interface{}{
    "method": "google_oauth",
    "user_agent": userAgent,
})
```

**入侵检测**
```bash
# 检测异常登录模式
awk '{print $1}' /var/log/nginx/access.log | sort | uniq -c | sort -nr | head -n 10 > /tmp/ip_stats.txt

# 检测异常请求模式
grep "POST /api/auth/login" /var/log/nginx/access.log | awk '{print $1}' | sort | uniq -c | awk '$1 > 100 {print $2}' > /tmp/suspicious_ips.txt
```


## 9. 灾备方案（简化版）

### 9.1 基础可用性

- 单容器部署，由ClawCloud保证可用性
- 定期备份到本地存储
- 监控告警：服务不可用时立即通知

## 10. 运维手册（简化版）

### 10.1 日常检查

- [ ] 检查服务状态
- [ ] 查看错误日志
- [ ] 确认备份成功

### 10.2 发布流程

1. 合并代码到main分支
2. 等待自动构建完成
3. 在ClawCloud部署新版本
4. 验证功能正常

通过以上简化的部署和运维方案，遵循Linus的原则，消除了所有不必要的复杂性，让系统更容易维护和部署。