# BatchGo 访问方式配置指南

BatchGo 现在支持两种访问方式：HTTP 访问和 Puppeteer 访问。每种方式都有其特定的配置选项和使用场景。

## 1. HTTP 访问

HTTP 访问方式使用标准的 HTTP 请求来访问目标 URL，速度快，资源消耗低。

### 配置参数

```json
{
  "access_method": "http",
  "http_headers": {
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    "Accept-Encoding": "gzip, deflate, br"
  },
  "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  "timeout": 30
}
```

### 特点

- ✅ 执行速度快
- ✅ 资源消耗低
- ✅ 支持自定义请求头
- ✅ 支持多种 Referer 选项（social、search、direct）
- ❌ 无法执行 JavaScript
- ❌ 无法处理动态内容

### 适用场景

- 简单的页面访问
- API 调用
- 静态页面检查
- 高并发批量任务

## 2. Puppeteer 访问

Puppeteer 访问方式使用 Chrome 浏览器来访问目标 URL，可以执行 JavaScript，处理动态内容。

### 配置参数

```json
{
  "access_method": "puppeteer",
  "headless": true,
  "viewport_width": 1920,
  "viewport_height": 1080,
  "wait_for_selector": "#content",
  "screenshot": true,
  "full_page": false,
  "timeout": 30
}
```

### 配置说明

- `headless`: 是否使用无头模式（默认 true）
- `viewport_width`: 视窗宽度（320-2560）
- `viewport_height`: 视窗高度（240-1920）
- `wait_for_selector`: 等待指定选择器出现（可选）
- `screenshot`: 是否截图（默认 false）
- `full_page`: 是否全页面截图（需要 screenshot 为 true）
- `timeout`: 超时时间（秒）

### 特点

- ✅ 可以执行 JavaScript
- ✅ 支持动态内容
- ✅ 可以进行截图
- ✅ 支持等待特定元素
- ❌ 执行速度较慢
- ❌ 资源消耗高
- ❌ 需要 Chrome/Chromium 环境

### 适用场景

- 需要执行 JavaScript 的页面
- SPA（单页应用）访问
- 需要截图的场景
- 页面自动化测试

## 3. 创建任务示例

### HTTP 访问任务

```bash
curl -X POST "http://localhost:8080/api/v1/batch/tasks" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "name": "HTTP批量访问测试",
    "type": "BATCH_OPEN",
    "urls": [
      "https://example.com/page1",
      "https://example.com/page2"
    ],
    "config": {
      "access_method": "http",
      "open_count": 3,
      "open_interval": 5,
      "cycle_count": 2,
      "http_headers": {
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
      },
      "referer_option": "search"
    }
  }'
```

### Puppeteer 访问任务

```bash
curl -X POST "http://localhost:8080/api/v1/batch/tasks" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "name": "Puppeteer动态页面访问",
    "type": "BATCH_CHECK",
    "urls": [
      "https://example.com/dynamic-page"
    ],
    "config": {
      "access_method": "puppeteer",
      "open_count": 1,
      "open_interval": 10,
      "cycle_count": 1,
      "viewport_width": 1920,
      "viewport_height": 1080,
      "wait_for_selector": "#main-content",
      "screenshot": true,
      "full_page": false,
      "timeout": 30
    }
  }'
```

## 4. 环境要求

### HTTP 访问

- 无特殊要求

### Puppeteer 访问

Docker 环境已预装 Chromium，包括：
- Chromium 浏览器
- 依赖库（nss, freetype, harfbuzz 等）
- 字体支持

本地开发环境需要：
- Chrome 或 Chromium 浏览器
- 虚拟显示（可选）

## 5. 性能对比

| 指标 | HTTP 访问 | Puppeteer 访问 |
|------|-----------|----------------|
| 执行速度 | 快（毫秒级） | 慢（秒级） |
| 内存使用 | 低（MB 级） | 高（百 MB 级） |
| 并发能力 | 高 | 低 |
| JavaScript 支持 | ❌ | ✅ |
| 截图功能 | ❌ | ✅ |
| 动态内容 | ❌ | ✅ |

## 6. 最佳实践

1. **根据需求选择访问方式**
   - 静态页面使用 HTTP
   - 动态页面使用 Puppeteer

2. **合理设置超时时间**
   - HTTP: 10-30 秒
   - Puppeteer: 30-60 秒

3. **控制并发数量**
   - HTTP: 可以高并发
   - Puppeteer: 建议低并发

4. **使用代理时注意**
   - 两种方式都支持代理配置
   - Puppeteer 使用代理可能需要额外配置

5. **错误处理**
   - 监控任务执行状态
   - 查看详细的错误日志
   - 根据错误类型调整配置