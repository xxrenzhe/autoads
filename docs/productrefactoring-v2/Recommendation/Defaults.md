# Recommendation — 默认参数库（MVP）

## 1. 特征抽取与规范化
- 行业分类：选用固定 taxonomy，多选；未知映射为 other。
- 关键词：
  - 文本处理：小写、去停用词、词干化/同义归并（简表），保留前 K=50 关键词；
  - 权重：TF-DF（变体）或频次；关键词集合用于 Jaccard 相似。
- 落地页要素：title/meta/heading 关键词 Top-20，n-gram(1–2)；
- 地域：ISO 国家码，支持多国；
- 历史曲线：归一化到 [0,1]（min-max），按 7/30 天分桶采样（曝光、点击、CTR、近似 ROSC）。

## 2. 召回与排序（默认）
- 召回：
  - industry 交集非空；
  - country 至少 1 个匹配（若 geo_match_required=true）；
  - keywords_jaccard ≥ 0.2；landing_keywords_overlap ≥ 3。
- 排序打分：
  - score = 0.4*industry_sim + 0.4*keywords_sim + 0.2*geo_sim；
  - 同域名去重与多样性约束：每域最多 2 个；
  - topN = 10；candidatePool = 500。

## 3. 证据摘要模板
- 行业匹配：[行业A, 行业B]；
- 关键词相似：Jaccard=0.31；命中词：[kw1, kw2, kw3…]；
- 地域：US=✓, UK=×；
- 近似曲线：CTR(7d)=0.8×，ROSC(7d)=0.9×（如可获得）。

## 4. 回退策略
- 候选不足（<topN）：放宽 keywords_jaccard 至 0.15，或放宽 geo；
- 完全无候选：提示“暂未找到高相似对象”，引导用户完善关键词与行业标签。

## 5. 性能与缓存
- 推荐结果按源 Offer 缓存 24h 或直至“成功范本”更新；
- 每次展示记录曝光/点击/采纳反馈（用于后续学习排序）。

## 6. 配置化参数（映射至 ConfigSchema）
- weights: industry/keywords/geo；
- thresholds: keywords_jaccard_min/landing_keywords_overlap_min/geo_match_required；
- topN/candidatePool/diversity。
