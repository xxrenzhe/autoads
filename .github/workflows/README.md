# GitHub Actions 工作流配置

## 🚀 主要工作流

### `docker.yml` - 主要CI/CD流程 ✅
**状态**: 启用  
**触发条件**: 
- Push到 `main` 分支 → 构建预览环境镜像 (`preview-latest`)
- Push到 `production` 分支 → 构建生产环境镜像 (`prod-latest`)
- 创建版本标签 (`v*`) → 构建带版本的生产镜像
- 手动触发

**功能**:
- 代码验证 (TypeScript检查 + ESLint)
- 应用构建
- Docker镜像构建和推送
- 安全扫描 (Trivy)
- 部署说明生成

## 🔧 辅助工作流

### `code-quality.yml` - 代码质量检查
**状态**: 仅PR触发  
**触发条件**: Pull Request到 `main`, `production`, `develop` 分支  
**功能**: ESLint检查、代码格式化验证

### `security.yml` - 安全扫描
**状态**: 仅PR和定时触发  
**触发条件**: 
- Pull Request到 `main`, `production`, `develop` 分支
- 每日定时扫描 (UTC 2:00 AM)
**功能**: 密钥检测、依赖漏洞扫描

### `sbom-generation.yml` - 软件物料清单
**状态**: 独立触发  
**功能**: 生成软件依赖清单

## ❌ 已禁用的工作流

### `build-and-push.yml` - 备用构建流程
**状态**: 禁用 (仅手动触发)  
**原因**: 与主要docker.yml流程冲突

### `deploy.yml` - 备用部署流程  
**状态**: 禁用 (仅手动触发)  
**原因**: 与主要docker.yml流程冲突

## 📋 工作流优先级

1. **主流程**: `docker.yml` - 处理所有push事件的构建和部署
2. **质量检查**: `code-quality.yml` + `security.yml` - 仅在PR时运行
3. **备用流程**: 其他工作流仅在需要时手动触发

## 🔄 部署流程

1. **开发** → Push到 `main` → 触发 `docker.yml` → 构建预览环境镜像
2. **生产** → Push到 `production` → 触发 `docker.yml` → 构建生产环境镜像
3. **发布** → 创建版本标签 → 触发 `docker.yml` → 构建版本化镜像

## 🛠️ 手动触发

所有工作流都支持手动触发 (`workflow_dispatch`)，可在GitHub Actions页面手动运行。

## 📝 注意事项

- 只有 `docker.yml` 会在代码推送时自动运行
- 其他工作流避免了触发条件冲突
- 保持了完整的CI/CD功能，同时避免了重复构建