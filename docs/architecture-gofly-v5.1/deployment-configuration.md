# 部署配置

### 11.1 Dockerfile

```dockerfile
# 多阶段构建
FROM golang:1.21-alpine AS builder

WORKDIR /app

# 安装依赖
RUN apk add --no-cache git

# 复制 go mod 文件
COPY go.mod go.sum ./
RUN go mod download

# 复制源代码
COPY . .

# 构建应用
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o main .

# 最终镜像
FROM alpine:latest

# 安装必要的包
RUN apk --no-cache add ca-certificates tzdata chromium

WORKDIR /root/

# 从构建阶段复制二进制文件
COPY --from=builder /app/main .
COPY --from=builder /app/config ./config

# 创建非 root 用户
RUN addgroup -g 1000 appgroup && \
    adduser -u 1000 -G appgroup -s /bin/sh -D appuser
RUN chown -R appuser:appgroup /root
USER appuser

# 暴露端口
EXPOSE 8080

# 启动应用
CMD ["./main"]
```

### 11.2 docker-compose.yml

```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "8080:8080"
    environment:
      - APP_ENV=production
      - DATABASE_URL=mysql://user:pass@db:3306/autoads
      - REDIS_URL=redis://redis:6379
    depends_on:
      - db
      - redis
    networks:
      - autoads-net
    restart: unless-stopped

  db:
    image: mysql:8.0
    environment:
      MYSQL_DATABASE: autoads
      MYSQL_USER: user
      MYSQL_PASSWORD: pass
      MYSQL_ROOT_PASSWORD: rootpass
    volumes:
      - mysql_data:/var/lib/mysql
    networks:
      - autoads-net
    restart: unless-stopped
    command: --default-authentication-plugin=mysql_native_password

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data
    networks:
      - autoads-net
    restart: unless-stopped

volumes:
  mysql_data:
  redis_data:

networks:
  autoads-net:
    driver: bridge
```