# Functional Spec — 智能 Offer 中心

## 范围与目标
- 范围：Offer 资产管理、状态/标签、核心 ROSC 指标、机会推荐引擎。
- 目标：解决资产管理混乱、成功不可复制（痛点1、7）。

## 用户故事（例）
- 作为操盘手，我可创建/归档 Offer，并查看其 ROSC 与阶段成果画布；当标记为“盈利”，系统自动推荐相似高潜 Offer。

## 能力清单
- Offer 资产库：创建/编辑/归档、标签、搜索过滤。
- 状态机：evaluating/optimizing/scaling/profitable/abandoned。
- ROSC：成本（Ads API 聚合）+ 收入（用户录入/导入）；显示目标带、置信度与延迟。
- 成功范本：可标记为“成功”；触发推荐。
- 机会推荐：基于行业/关键词/受众/落地页要素相似度；冷启动用规则，迭代向嵌入检索。

## 交互与视图
- 列表卡片：状态、ROSC、最近动作、下一步 CTA、风险徽标。
- 详情页：阶段成果画布（评估/仿真/放大）+ ROSC 趋势 + 证据链展开。

## 数据与接口
- 读模型：Offer、SiterankAnalysis、BatchopenTask、AdscenterCampaign、TokenTransaction（引用）。
- ROSC：spend via Ads API、revenue via user input；保存明细与来源。

## 验收标准
- Given 创建/编辑/归档操作，When 保存，Then 列表与详情实时更新且可审计。
- Given 标记“盈利”，When 成功，Then 展示≥5条相似 Offer 推荐并可加入待办。
