# Google Ads链接自动化管理系统

## 概述

这是一个自动化管理Google Ads推广链接的系统，通过AdsPower指纹浏览器跟踪原始推广链接，提取最终URL并自动更新Google Ads广告信息。

## 功能特性

### 🔧 配置管理
- Google Ads账户OAuth认证和连接
- AdsPower环境配置
- 原始推广链接管理
- 链接与广告的映射配置

### 🚀 自动化执行
- 支持手动触发执行
- 支持定时执行（每日、每周、自定义）
- 智能延时和重试机制
- 实时执行状态监控

### 📊 数据处理
- URL自动提取和解析
- Final URL和参数分离
- 批量Google Ads更新
- 执行结果统计分析

### 📧 通知报告
- 邮件执行报告
- 详细的成功/失败统计
- 历史记录查询
- 数据导出功能

## 文件结构

```
src/app/adscenter/
├── page.tsx              # Next.js页面入口
├── AdsCenterClient.tsx  # 主要客户端组件
├── types.ts              # TypeScript类型定义
├── utils.ts              # 工具函数
└── README.md             # 文档说明
```

## 核心数据模型

### TrackingConfiguration
跟踪配置的核心数据结构，包含：
- 基础配置信息（名称、环境ID、执行次数等）
- Google Ads账户和广告信息
- 调度设置
- 状态跟踪

### ExecutionResult
执行结果数据结构，包含：
- 执行状态和进度
- 处理的链接结果
- 错误信息和指标
- 执行阶段跟踪

### LinkResult
单个链接处理结果，包含：
- 原始URL和最终URL
- 参数分离结果
- 执行顺序和分配的广告
- 处理时间和状态

## 业务流程

### 阶段1：配置设置
1. Google Ads账户OAuth认证
2. 获取账户下的广告系列和广告信息
3. 配置AdsPower环境和原始链接
4. 建立链接与广告的映射关系

### 阶段2：自动化执行
1. AdsPower浏览器控制和URL提取
2. 按执行次数获取多个最终URL
3. Google Ads批量更新
4. 结果通知和报告生成

## 开发状态

- [x] 基础项目结构搭建
- [x] 核心数据类型定义
- [x] 主要UI组件框架
- [x] 工具函数库
- [ ] Google Ads OAuth集成
- [ ] AdsPower API集成
- [ ] 执行流程编排
- [ ] 调度系统
- [ ] 通知系统

## 技术栈

- **前端**: Next.js 14, React, TypeScript
- **UI组件**: Tailwind CSS, Lucide Icons
- **状态管理**: React Hooks
- **数据存储**: Browser LocalStorage
- **API集成**: Google Ads API, AdsPower API

## 下一步开发计划

1. 实现Google Ads OAuth认证流程
2. 构建AdsPower API集成
3. 开发配置管理界面
4. 实现执行流程编排器
5. 添加调度和通知功能