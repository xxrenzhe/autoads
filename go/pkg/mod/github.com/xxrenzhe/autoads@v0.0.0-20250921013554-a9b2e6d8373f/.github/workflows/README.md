# GitHub Actions 工作流配置

## 🚀 主要工作流（单一）

### `docker.yml` - 单一构建发布流程 ✅
**状态**: 启用  
**触发条件**: 
- Push到 `main` 分支 → 构建预览环境镜像 (`preview-latest`)
- Push到 `production` 分支 → 构建生产环境镜像 (`prod-latest`)
- 创建版本标签 (`v*`) → 构建带版本的生产镜像 (`prod-{tag}`)
- 手动触发

**功能**:
- 按 MustKnow.md 生成标签与域名元信息
- 使用 `Dockerfile.standalone` 构建并推送镜像
- 平台固定为 `linux/amd64`
- 生成构建摘要（镜像、摘要、环境、域名）

## ❌ 已弃用（仅手动触发，供排障）

- `optimized-build.yml` → 已由 `docker.yml` 取代（修正为统一使用 `Dockerfile.standalone`）
- `autoads-saas-cicd.yml` → 拆分出的质量与集成步骤不再自动触发
- `build-gofly-admin.yml` → 多架构构建已停用，统一为 amd64

如需使用上述流程，请在 Actions 页面手动运行。

## 📋 工作流优先级

1. **主流程**: `docker.yml` - 处理所有 push/tag 的镜像构建与发布
2. **备用/排障**: 其他工作流仅在需要时手动触发

## 🔄 部署流程

1. **开发** → Push到 `main` → `docker.yml` → 构建 `preview-latest`
2. **生产** → Push到 `production` → `docker.yml` → 构建 `prod-latest`
3. **发布** → 创建 `v*` 标签 → `docker.yml` → 构建 `prod-{tag}`

## 🛠️ 手动触发

所有工作流都支持手动触发 (`workflow_dispatch`)，可在GitHub Actions页面手动运行。

## 📝 注意事项

- 只有 `docker.yml` 会在代码推送时自动运行
- 其他工作流避免了触发条件冲突
- 保持了完整的CI/CD功能，同时避免了重复构建
