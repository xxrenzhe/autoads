# 移除 Playwright + Puppeteer 依赖计划

## 📋 当前依赖分析

### NPM 依赖
- `@playwright/test`: E2E 测试框架
- `@playwright/experimental-ct-react`: React 组件测试
- `playwright`: 浏览器自动化库
- `puppeteer`: 仅用于 AdsPower 连接

### 受影响的文件

#### 1. 配置文件
- `src/lib/config/playwright-optimization.ts` - Playwright 优化配置
- `analyze-adspower-playwright.mjs` - AdsPower 分析脚本
- `scripts/playwright-compatibility-check.sh` - 兼容性检查脚本

#### 2. 核心服务文件
- `src/lib/services/smart-request-scheduler.ts` - 智能请求调度器
- `src/lib/services/session-cookie-manager.ts` - 会话Cookie管理器
- `src/lib/utils/session-manager.ts` - 会话管理器
- `src/app/adscenter/models/AdsPowerService.ts` - AdsPower服务（仅Puppeteer）

#### 3. 工具文件
- `src/lib/utils/ad-link-handler.ts` - 广告链接处理器
- `src/lib/utils/dynamic-imports.ts` - 动态导入工具

#### 4. 测试文件
- `e2e/admin/admin-workflows.spec.ts` - E2E 测试
- 所有 Playwright 相关测试

#### 5. Package.json 脚本
需要移除的脚本：
- `test:smoke`
- `test:smoke:production`
- `test:e2e*` 系列
- `docker:compatibility-check`

## 🎯 移除策略

### 阶段1: 移除 Playwright 依赖
1. 保留 AdsPower 的 Puppeteer 连接（官方支持）
2. 移除所有 Playwright 相关代码
3. 重构受影响的服务

### 阶段2: 替代方案实现
1. 使用 HTTP 客户端替代浏览器自动化
2. 简化会话管理
3. 移除复杂的指纹保护

### 阶段3: 清理和优化
1. 移除配置文件
2. 清理测试文件
3. 更新文档

## 🔧 具体实施步骤

### 步骤1: 备份当前状态
```bash
git add .
git commit -m "backup: 移除Playwright前的备份"
```

### 步骤2: 移除依赖
```bash
npm uninstall playwright playwright-core @playwright/test @playwright/experimental-ct-react
```

### 步骤3: 重构核心服务
- 将浏览器自动化替换为 HTTP 请求
- 简化会话管理逻辑
- 保留 AdsPower 的 Puppeteer 连接

### 步骤4: 清理文件
- 删除配置文件
- 删除测试文件
- 更新 package.json

## ⚠️ 风险评估

### 高风险
- AdsPower 连接功能可能受影响
- URL 访问功能需要重新实现

### 中风险
- 会话管理功能需要重构
- 代理功能可能需要调整

### 低风险
- E2E 测试移除（可用其他方式替代）
- 配置文件清理

## 🚀 预期收益

### 内存优化
- 减少 ~200MB 内存占用
- 移除浏览器进程开销

### 启动速度
- 减少依赖加载时间
- 简化启动流程

### 维护成本
- 减少复杂的浏览器兼容性问题
- 简化部署配置

## 📝 实施检查清单

- [ ] 备份当前代码
- [ ] 移除 npm 依赖
- [ ] 重构 smart-request-scheduler
- [ ] 重构 session-cookie-manager
- [ ] 重构 session-manager
- [ ] 保留 AdsPower Puppeteer 连接
- [ ] 移除 ad-link-handler 中的 Playwright 配置
- [ ] 更新 dynamic-imports
- [ ] 删除配置文件
- [ ] 删除测试文件
- [ ] 更新 package.json 脚本
- [ ] 测试核心功能
- [ ] 更新文档