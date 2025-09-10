# 4G容器内存配置分析

## 🎯 内存分配策略

### 4G容器内存分布
```
总内存: 4096MB
├── 系统内存: ~300MB (OS + Docker)
├── Node.js堆: 2048MB (50%)
├── 缓冲区: ~500MB (网络/文件I/O)
├── Redis缓存: ~200MB (如果使用内存fallback)
└── 安全边界: ~1048MB (25%)
```

### 当前配置问题
- **768MB太保守**: 只使用了19%的可用内存
- **性能受限**: Next.js构建和运行时可能内存不足
- **资源浪费**: 4G容器的优势没有发挥

### 推荐配置

#### 高性能生产环境 (8G容器)
```dockerfile
ENV NODE_OPTIONS="--max-old-space-size=4096 --max-semi-space-size=256"
```

#### 标准生产环境 (4G容器)
```dockerfile
ENV NODE_OPTIONS="--max-old-space-size=2048 --max-semi-space-size=128"
```

#### 预发环境 (2G容器)
```dockerfile
ENV NODE_OPTIONS="--max-old-space-size=1024 --max-semi-space-size=64"
```

#### 开发环境 (1G容器)
```dockerfile
ENV NODE_OPTIONS="--max-old-space-size=512 --max-semi-space-size=32"
```

## 📈 性能对比

| 配置 | 堆内存 | 适用场景 | 性能表现 |
|------|--------|----------|----------|
| 512MB | 50% | 1G容器 | 开发环境 |
| 1024MB | 50% | 2G容器 | 预发环境 |
| 2048MB | 50% | 4G容器 | 标准生产 |
| 4096MB | 50% | 8G容器 | 高性能生产 |

## 🔧 动态配置方案

根据容器内存自动调整：
```bash
# 获取容器内存
CONTAINER_MEMORY=$(cat /sys/fs/cgroup/memory/memory.limit_in_bytes)
MEMORY_GB=$((CONTAINER_MEMORY / 1024 / 1024 / 1024))

# 动态设置堆内存 (50%规则)
if [ $MEMORY_GB -ge 8 ]; then
    NODE_HEAP=4096
elif [ $MEMORY_GB -ge 4 ]; then
    NODE_HEAP=2048
elif [ $MEMORY_GB -ge 2 ]; then
    NODE_HEAP=1024
else
    NODE_HEAP=512
fi

export NODE_OPTIONS="--max-old-space-size=$NODE_HEAP"
```

## ⚡ 优化建议

1. **4G容器使用2048MB堆内存**
2. **启用增量GC**: `--incremental-marking`
3. **优化GC频率**: `--gc-interval=100`
4. **监控内存使用**: 实时监控和告警