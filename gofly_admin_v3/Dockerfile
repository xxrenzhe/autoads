# 多阶段构建 Dockerfile for AutoAds SaaS

# 阶段1: 构建Go应用
FROM golang:1.23-alpine AS go-builder

# 安装必要的包
RUN apk add --no-cache git ca-certificates tzdata

# 设置工作目录
WORKDIR /app

# 复制go mod文件
COPY go.mod go.sum ./

# 下载依赖
RUN go mod download

# 复制源代码
COPY . .

# 构建应用
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o main ./cmd/main.go

# 阶段2: 构建Next.js前端（如果存在）
FROM node:18-alpine AS frontend-builder

WORKDIR /frontend

# 复制前端文件（如果存在）
COPY frontend/package*.json ./
RUN npm ci --only=production

COPY frontend/ ./
RUN npm run build

# 阶段3: 最终镜像
FROM alpine:latest

# 安装必要的运行时依赖
RUN apk --no-cache add ca-certificates tzdata curl iproute2 procps ripgrep

# 创建非root用户
RUN addgroup -g 1001 -S autoads && \
    adduser -S autoads -u 1001 -G autoads

# 设置工作目录
WORKDIR /app

# 从构建阶段复制二进制文件
COPY --from=go-builder /app/main .

# 从构建阶段复制前端静态文件（如果存在）
COPY --from=frontend-builder /frontend/dist ./static/

# 复制配置文件
COPY configs/ ./configs/


# 设置权限
RUN chown -R autoads:autoads /app
USER autoads

# 暴露端口
EXPOSE 8080

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

# 启动应用
CMD ["./main"]
