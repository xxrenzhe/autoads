功能点 [1]: Google OAuth 登录/注册
  作为 前台用户,
  我想要 使用 Google 一键登录并创建账户,
  以便于 立即使用平台功能并享有试用/基础订阅。
  验收标准 (AC):
    AC1: Given 用户未登录, When 点击任一需要登录的操作按钮(ProtectedButton), Then 弹出登录弹窗且不执行原操作。
    AC2: Given 用户通过 Google 成功授权, When 首次登录完成, Then 在数据库创建用户记录并创建订阅(优先 Pro 14 天试用, 否则 Free), 状态为 ACTIVE。
    AC3: Given 用户状态为非 ACTIVE, When 尝试登录, Then 拒绝登录并不建立会话。
    AC4: Given 登录成功, When 获取会话, Then 返回 user.id/email/role/status 等字段且 session 有效期与配置一致。

功能点 [2]: 管理员账号密码登录
  作为 管理员,
  我想要 通过邮箱+密码登录后台控制台,
  以便于 管理用户、订阅与系统配置。
  验收标准 (AC):
    AC1: Given 用户为 ADMIN 且密码正确, When 访问 /ops/console/login 并提交表单, Then 登录成功并重定向至 /ops/console/panel。
    AC2: Given 用户不是 ADMIN, When 使用凭证登录, Then 返回错误且不建立会话。
    AC3: Given 用户无密码或密码校验失败, When 提交登录, Then 返回“邮箱或密码错误”。
    AC4: Given 未登录或非管理员, When 访问 /ops/* 管理网关, Then 重定向至 /ops/console/login 并附带 callbackUrl。

功能点 [3]: 获取订阅限制
  作为 已登录用户,
  我想要 查询当前套餐的功能限制,
  以便于 明确批量限制、可用版本和速率上限。
  验收标准 (AC):
    AC1: Given 用户已登录, When GET /api/user/subscription/limits, Then 返回 planId/planName 以及 limits.siterank.batchLimit、batchopen.versions、api.rateLimit 等字段。
    AC2: Given 未登录, When GET /api/user/subscription/limits, Then 返回 401。
    AC3: Given 存在激活订阅, When 调用接口, Then 返回根据 PlanFeature 解析后的版本可用性与限制值。

功能点 [4]: 功能权限守卫(Feature Guard)
  作为 平台后端,
  我想要 在 API 层校验功能权限与 Token,
  以便于 按套餐与余额安全管控功能调用。
  验收标准 (AC):
    AC1: Given 用户未登录, When 访问受保护 API(包裹 withFeatureGuard), Then 返回 401。
    AC2: Given 用户无该功能访问权限, When 调用 API, Then 返回 403 且 code=FEATURE_ACCESS_DENIED。
    AC3: Given 需要消耗 Token 且余额不足, When 调用 API, Then 返回 402 且 code=INSUFFICIENT_TOKENS 并包含 required/balance。
    AC4: Given 访问成功, When 返回响应, Then Header 包含 X-Feature-Limits(当前功能限制 JSON)。

功能点 [5]: Token 消费与记录
  作为 已登录用户,
  我想要 在执行功能前消费 Token 并记录账单,
  以便于 按操作透明计费与溯源。
  验收标准 (AC):
    AC1: Given 用户已登录且余额充足, When POST /api/user/tokens/consume 含 {feature,operation,tokens}, Then 返回 {success:true, remainingBalance, consumed} 并写入 token_usage。
    AC2: Given 余额不足, When 调用该接口, Then 返回 402 且 error='Insufficient token balance'。
    AC3: Given 请求体不合法, When 调用该接口, Then 返回 400 且包含 Zod 校验错误详情。
    AC4: Given 用户不存在(数据异常), When 调用该接口, Then 返回 404。

功能点 [6]: 批量打开(基础版) — 浏览器标签页打开
  作为 前台用户,
  我想要 一次性在浏览器打开多条 URL,
  以便于 快速进行批量访问测试。
  验收标准 (AC):
    AC1: Given 已登录且输入>=1条 http/https URL, When 点击“批量打开”, Then 逐个以新标签打开并实时更新进度条与状态文案。
    AC2: Given 弹窗策略阻止窗口, When 尝试 window.open 失败, Then 标记 popupBlocked=true 且显示“弹窗被阻止”提示。
    AC3: Given 输入为空, When 点击“批量打开”, Then 不执行打开并显示“请输入至少一个URL”。
    AC4: Given Token 余额不足, When 点击“批量打开”, Then 不执行打开并显示“Token余额不足，请充值后重试”。
    AC5: Given 执行完成, When 所有URL处理完毕, Then 停止“打开中”状态并显示完成数量。

功能点 [7]: 批量打开(基础版) — 终止与清空
  作为 前台用户,
  我想要 一键终止当前批量打开并清理状态,
  以便于 迅速停止异常或误操作的执行。
  验收标准 (AC):
    AC1: Given 正在批量打开, When 点击“终止”或执行 handleTerminate, Then 立即置 isOpening=false 且 isTerminated=true 并显示“批量打开已终止”。
    AC2: Given 点击“清空”, When 执行 handleClear, Then 关闭已打开窗口、重置进度/状态/错误并清理缓存分母。
    AC3: Given 终止后仍收到进度消息, When 事件到达, Then 前端忽略该进度且不再更新 UI。

功能点 [8]: 批量打开(静默版) — 启动任务
  作为 付费用户,
  我想要 在后端以静默模式并发访问 URL,
  以便于 支持代理、Referer、并发与更高稳定性。
  验收标准 (AC):
    AC1: Given 用户具备 batchopen 对应版本权限且余额充足, When POST /api/batchopen/silent-start 含 {taskId,urls[],cycleCount,...}, Then 返回 {success:true,data:{status:'running',totalVisits,...}}。
    AC2: Given 请求体字段不合法, When 调用该接口, Then 返回 400 并包含 Zod 错误信息。
    AC3: Given 相同 taskId 已在运行, When 再次启动, Then 返回业务错误 TASK_ALREADY_RUNNING。
    AC4: Given 通过 requireFeature 包装, When 用户未登录或权限不足或余额不足, Then 分别返回 401/403/402。
    AC5: Given 启动成功, When 任务执行异常, Then 任务状态持久化为 failed 且保存错误摘要。
    AC6: Given accessMode in ['http','puppeteer'], When 提交含 accessMode 的请求, Then 服务端按所选模式执行；Given 其它取值, Then 返回 400。
    AC7: Given 选择 'puppeteer' 且 maxConcurrency 超出 [1,10], When 调用, Then 返回 400；Given 合法范围内, Then 以该并发度调度并受 5 分钟 maxDuration 与资源限制保护。

功能点 [9]: 批量打开(静默版) — 进度查询
  作为 付费用户,
  我想要 轮询查询静默任务进度,
  以便于 实时掌握执行状态与剩余时间。
  验收标准 (AC):
    AC1: Given 任务存在, When GET /api/batchopen/silent-progress?taskId=xxx, Then 返回 {success:true,progress,total,status,message} 并带速率限制响应头。
    AC2: Given taskId 不存在, When 查询, Then 返回 404 且 code=NOT_FOUND。
    AC3: Given 出现连接/超时异常, When 查询, Then 分别返回 503/504 且包含 code 与错误信息。
    AC4: Given 命中自定义速率限制策略, When 高频轮询, Then 返回 429 并包含剩余/重置时间。

功能点 [10]: 批量打开(静默版) — 终止任务
  作为 付费用户,
  我想要 主动终止自己发起的静默任务,
  以便于 控制成本并快速止损。
  验收标准 (AC):
    AC1: Given 任务属于当前用户且在运行, When POST /api/batchopen/silent-terminate 含 {taskId}, Then 返回 {success:true,message} 并停止执行。
    AC2: Given 任务不存在, When 终止, Then 返回 404。
    AC3: Given 任务不属于当前用户, When 终止, Then 返回 403。

功能点 [11]: 批量打开 — 版本可用性查询
  作为 已登录用户,
  我想要 查询自己可用的批量打开版本,
  以便于 知道是否支持 basic/silent/automated。
  验收标准 (AC):
    AC1: Given 已登录, When GET /api/batchopen/version?feature=batchopen, Then 返回各版本 available/name/description/maxUrls/maxConcurrent。
    AC2: Given 参数缺失或无效, When 调用, Then 返回 400。
    AC3: Given 无激活订阅(允许匿名策略为false时), When 调用, Then 可根据配置返回空可用版本或最低级可用版本。

功能点 [12]: 代理 URL 校验
  作为 前台用户,
  我想要 提交代理 URL 进行合法性校验,
  以便于 在静默任务前验证代理可用。
  验收标准 (AC):
    AC1: Given 提交有效代理 URL, When POST /api/batchopen/proxy-url-validate, Then 返回 200 且包含校验结果字段。
    AC2: Given 使用非 POST 方法, When 访问该路径, Then 返回 405 并在响应头包含 Allow: POST。
    AC3: Given 请求体缺失或格式错误, When 调用, Then 返回 400。

功能点 [13]: 站点排名 — 单域名查询
  作为 已登录用户,
  我想要 查询单个域名的全球排名与流量,
  以便于 评估站点权威度与测试优先级。
  验收标准 (AC):
    AC1: Given 合法域名参数且余额充足, When GET /api/siterank/rank?domain=example.com, Then 返回 {success:true,data:{globalRank,monthlyVisits},fromCache,rateLimitInfo}。
    AC2: Given 域名格式非法(含协议/路径/不合规 TLD), When 查询, Then 返回 400 且 error='无效的域名格式' 并记录无效请求。
    AC3: Given 触发 IP 速率限制, When 查询, Then 返回 429 或 403(被封禁) 且包含剩余与重置时间。
    AC4: Given 余额不足或无权限, When 查询, Then 返回 402 或 403(由 withFeatureGuard 决定)。
    AC5: Given 服务内部错误, When 查询, Then 返回 500 且 error='查询失败'。

功能点 [14]: 站点排名 — 批量查询
  作为 已登录用户,
  我想要 批量提交多个域名进行查询,
  以便于 快速为大列表生成分析结果。
  验收标准 (AC):
    AC1: Given 合法 domains 数组且未超套餐 batchLimit, When POST /api/siterank/rank, Then 返回 data[](每项含 status/globalRank/monthlyVisits) 及 successRate。
    AC2: Given domains 超过 batchLimit, When 调用, Then 返回 400 且 error='域名列表不能超过{limit}个'。
    AC3: Given 数组中存在非法域名, When 调用, Then 响应成功但标注错误项并记录 invalid 请求(最多记录10个)。
    AC4: Given 命中批量速率限制, When 高频批量调用, Then 返回 429/403 并包含限流头。
    AC5: Given 余额不足, When 调用, Then 返回 402 并不产生成功计费。
    AC6: Given body 包含 concurrency(默认3), When 调用, Then 服务端将 domains 拆分为单域名查询并发执行, 并遵守 IP 速率限制与缓存策略；Given 非法并发值(<=0 或 过大), Then 返回 400。
    AC7: Given 并发执行, When 所有域名完成, Then 返回 successful/failed/successRate 汇总字段与每项结果列表。

功能点 [15]: 站点排名 — 批量输入与限制提示（前端）
  作为 前台用户,
  我想要 在输入区实时去重计数与接近/超限提示,
  以便于 在提交分析前修正输入规模。
  验收标准 (AC):
    AC1: Given 文本区存在多行 URL, When 实时输入, Then 自动抽取域名、去重并显示总数与重复数。
    AC2: Given 去重后数量接近/超过 batchLimit, When 渲染提示, Then 分别显示“接近限制/超过限制”且禁用“开始分析”。
    AC3: Given 点击“开始分析”, When 未登录, Then 触发登录弹窗且不发送请求。
    AC4: Given 点击“开始分析”, When 合法可执行, Then 立即渲染占位结果并后台逐步回填数据与进度文本。

功能点 [16]: 站点排名 — 结果表格与 Excel 导出
  作为 前台用户,
  我想要 在表格中筛选/排序并导出结果,
  以便于 线下评审与归档。
  验收标准 (AC):
    AC1: Given 已有分析结果, When 输入搜索关键字, Then 仅展示包含该域名的行。
    AC2: Given 点击列头, When 切换排序, Then 以 asc/desc 排列相应字段。
    AC3: Given 点击“导出Excel”, When 有结果, Then 生成并下载 xlsx 文件且列名为本地化显示名。
    AC4: Given 尚未执行分析, When 点击导出, Then 不产生下载。

功能点 [17]: 站点排名 — 优先级计算与去 Loading
  作为 前台用户,
  我想要 将 SimilarWeb 数据转化为“测试优先级”,
  以便于 聚焦高价值站点。
  验收标准 (AC):
    AC1: Given 所有域名查询完成, When 计算优先级, Then 基于 GlobalRank(60%)+MonthlyVisits(40%) 输出数值并分档展示。
    AC2: Given 个别域名查询失败或超时, When 最终清理, Then 将其 loading 字段替换为 null 并保留原始列。
    AC3: Given 重复域名出现在多行, When 某域名结果返回, Then 同步更新对应的所有行。

功能点 [18]: AdsCenter — Google Ads 账户管理
  作为 付费用户,
  我想要 新增与查看 Google Ads 账户,
  以便于 为自动化执行配置账户资源。
  验收标准 (AC):
    AC1: Given 已登录且具备 adscenter 权限, When POST /api/adscenter/accounts 含 accountId/accountName, Then 返回成功并可在列表看到新账户。
    AC2: Given 请求缺少必填字段, When 提交新增, Then 返回 400 并不创建记录。
    AC3: Given 未登录或无权限, When 访问 /api/adscenter/accounts, Then 返回 401/403。

功能点 [19]: AdsCenter — 执行配置管理
  作为 付费用户,
  我想要 创建/查看执行配置,
  以便于 定义链接采集与广告更新的规则。
  验收标准 (AC):
    AC1: Given 合法配置 JSON, When POST /api/adscenter/configurations, Then 返回创建成功并可在列表看到。
    AC2: Given 配置 JSON 语法错误, When 提交, Then 返回 400 并提示解析错误。
    AC3: Given 未登录或无权限, When 请求配置接口, Then 返回 401/403。

功能点 [20]: AdsCenter — 启动执行与监控
  作为 付费用户,
  我想要 启动一次链接更新执行并查看进度,
  以便于 实时把控执行状态与产出。
  验收标准 (AC):
    AC1: Given 合法 configuration_id, When POST /api/adscenter/executions, Then 返回执行已创建并在“执行监控”页展示进度/已处理数/开始时间等。
    AC2: Given 执行过程失败, When 拉取详情, Then 状态为 failed 且有错误摘要/日志。
    AC3: Given 无权限, When 调用执行接口, Then 返回 401/403。

功能点 [21]: AdsCenter — 设置向导
  作为 付费用户,
  我想要 通过引导完成 Google Ads、联盟链接、AdsPower 环境与配置的初始化,
  以便于 快速搭建可运行的自动化流程。
  验收标准 (AC):
    AC1: Given 进入 /changelink/setup, When 逐步填写并保存每步表单, Then 后端 /api/adscenter/settings 接口分别持久化各类配置并返回当前进度。
    AC2: Given 必填项缺失或账号验证失败, When 保存该步, Then 返回明确错误并保持当前步状态不前进。
    AC3: Given 所有必需步骤完成, When 进入“验证与测试”, Then 可以触发一次测试运行并得到明确结果。

功能点 [22]: 管理后台 — 访问控制
  作为 管理员,
  我想要 保护 /ops/* 管理网关（经 Next → Go 控制台）,
  以便于 仅授权管理员可访问后台功能。
  验收标准 (AC):
    AC1: Given 未登录或非管理员, When 访问 /ops/* 管理网关, Then 重定向至 /ops/console/login 并携带 callbackUrl。
    AC2: Given 已登录管理员, When 访问后台路由, Then 正常返回页面或 JSON 数据。
    AC3: Given 后台中间件异常, When 访问, Then 重定向至 /auth/admin-signin?error=AuthError。

功能点 [23]: 管理后台 — Token 配置管理
  作为 管理员,
  我想要 配置 SITERANK/BATCHOPEN/ADSCENTER 的 Token 单价与批量系数,
  以便于 快速调优计费策略。
  验收标准 (AC):
    AC1: Given 管理员身份, When GET /ops/api/v1/console/token-config, Then 返回当前三大功能的价格与批量系数配置。
    AC2: Given 管理员身份, When PUT /ops/api/v1/console/token-config 传入合法配置, Then 原子性更新配置并记录变更历史(config_change_history)。
    AC3: Given 非管理员, When 访问该接口, Then 返回 403。
    AC4: Given 高频访问, When 触发接口速率限制, Then 返回 429 并包含限流头信息。

功能点 [24]: 管理后台 — Token 使用分析
  作为 管理员,
  我想要 查看 Token 使用概览/按用户/按功能/时间序列,
  以便于 评估消耗与优化产品策略。
  验收标准 (AC):
    AC1: Given 管理员身份, When GET /ops/api/v1/console/tokens/usage/overview|by-user|by-feature|time-series, Then 返回统计 JSON(包含区间/聚合/计数)。
    AC2: Given 非管理员, When 调用上述接口, Then 返回 403。
    AC3: Given 查询窗口无数据, When 调用, Then 返回 200 且各项数值为 0。

功能点 [25]: 管理后台 — 通知模板管理
  作为 管理员,
  我想要 CRUD 通知模板,
  以便于 配置系统通知内容与变量。
  验收标准 (AC):
    AC1: Given 管理员身份, When GET/PUT/DELETE /ops/api/v1/console/notification-templates/[id], Then 分别返回读取/更新/删除结果及 200 状态码。
    AC2: Given 模板不存在, When GET/DELETE, Then 返回 404。
    AC3: Given 非管理员, When 访问接口, Then 返回 403。

功能点 [26]: IP 速率限制与自动封禁
  作为 平台安全策略,
  我想要 对 /api/* 请求进行滑动窗口限流与自动封禁,
  以便于 防止滥用与异常抓取。
  验收标准 (AC):
    AC1: Given 正常访问频率, When 调用受保护 API, Then 返回 2xx 且响应头含 X-RateLimit-* 信息(当适用)。
    AC2: Given 在窗口内超过阈值, When 继续请求, Then 返回 429 并包含 resetTime 与 remaining。
    AC3: Given 频繁非法参数(如无效域名), When 达到自动封禁阈值, Then 返回 403 且附带 banInfo(原因/等级/过期时间)。

功能点 [27]: 邀请注册与试用订阅
  作为 新用户,
  我想要 使用邀请码或自动领取试用订阅,
  以便于 更快体验 Pro 能力。
  验收标准 (AC):
    AC1: Given 携带有效邀请码首次 OAuth 登录, When 创建用户, Then 应用邀请并创建相应订阅, 若失败则回退到 Pro 试用或 Free。
    AC2: Given 无邀请码, When 首次 OAuth 登录, Then 自动创建 Pro 试用(可用时)或 Free 订阅并回写用户余额。
    AC3: Given 已使用试用, When 再次登录, Then 不重复创建。
    AC4: Given 通过邀请码完成注册, When 被邀请者创建成功并激活, Then 邀请者与被邀请者同时获得 30 天 Pro 套餐并发放对应 tokenQuota；二者现有有效订阅将按政策顺延或升级。
    AC5: Given 邀请码被重复使用或重复触发奖励, When 再次调用奖励流程, Then 奖励发放幂等且不会重复累计。

功能点 [29]: 管理后台 — 用户管理
  作为 管理员,
  我想要 在后台检索/查看/编辑用户并进行状态与角色管控,
  以便于 维护用户生命周期与风险控制。
  验收标准 (AC):
    AC1: Given 管理员身份, When 打开用户列表, Then 可按姓名/邮箱/角色/状态/是否有订阅过滤与搜索, 列表展示 token 用量与订阅概览。
    AC2: Given 管理员身份, When 编辑用户角色或状态(ACTIVE/INACTIVE/BANNED), Then 变更成功写入数据库并即时生效(禁止非管理员自升权限)。
    AC3: Given 管理员身份, When 查看单个用户详情, Then 展示订阅、Token 余额/当月用量、登录信息与设备指纹等基础信息。
    AC4: Given 非管理员, When 访问用户管理接口或页面, Then 返回 403 或重定向至后台登录页。

功能点 [30]: 管理后台 — 订阅套餐管理
  作为 管理员,
  我想要 管理套餐(Plan)与功能(PlanFeature)及其限额,
  以便于 配置各功能的开通范围、批量上限与 Token 配额。
  验收标准 (AC):
    AC1: Given 管理员身份, When 创建/编辑套餐, Then 可设置 name/id/isActive/tokenQuota/rateLimit/billingPeriod/priceId 等并保存成功。
    AC2: Given 管理员身份, When 为套餐配置功能项(PlanFeature), Then 可启用/禁用并设置 limit(如 WEBSITE_RANKING_BATCH_LIMIT、REAL_CLICK_*、AUTOMATED_ADS)。
    AC3: Given 计划被在用, When 试图删除, Then 返回 409 并阻止删除；允许编辑但需确保不降低已用配额引发不一致。
    AC4: Given 更新套餐功能, When 用户再次获取 /api/user/subscription/limits, Then 看到与 PlanFeature 对应的最新可用版本与限制。

功能点 [28]: 定时任务 — 试用到期处理
  作为 平台运营,
  我想要 周期性处理即将到期的试用,
  以便于 自动降级与通知。
  验收标准 (AC):
    AC1: Given 触发 /api/cron/trial-expiration, When 存在到期试用, Then 标记订阅状态并记录处理结果。
    AC2: Given 无到期记录, When 执行, Then 返回 200 且处理数为 0。

功能点 [31]: 管理后台 — 角色与权限(RBAC)管理
  作为 管理员,
  我想要 管理角色与权限并绑定到资源与菜单,
  以便于 控制后台各模块的访问授权。
  验收标准 (AC):
    AC1: Given 管理员身份, When 创建角色并勾选权限(siterank:read、batchopen:read、adscenter:read、api:read 等), Then 保存成功并持久化至数据库。
    AC2: Given 角色已被用户绑定, When 尝试删除该角色, Then 返回 409 并阻止删除；允许编辑权限项并即时生效。
    AC3: Given 角色无某权限, When 访问对应 API 或菜单, Then API 返回 403 或菜单不可见(受 usePermissions 控制)。

功能点 [32]: 管理后台 — 系统配置(SystemConfig)管理
  作为 管理员,
  我想要 按分类管理系统运行参数并留痕,
  以便于 安全、可追溯地调整系统行为。
  验收标准 (AC):
    AC1: Given 管理员身份, When 新增/编辑配置项(key/value/category/isSecret), Then 成功写入并记录 config_change_history。
    AC2: Given isSecret=true 的项, When 在列表/详情查看, Then 仅显示掩码值；导出/审计日志亦不泄露明文。
    AC3: Given 非法 key 或校验不通过, When 保存, Then 返回 400 并显示 validation 详情。

功能点 [33]: 管理后台 — 环境变量(EnvironmentVariable)管理
  作为 管理员,
  我想要 管理运行所需的环境变量并审计变更,
  以便于 统一、可控地配置敏感参数。
  验收标准 (AC):
    AC1: Given 管理员身份, When 创建/编辑/删除环境变量, Then 成功且 key 全局唯一；删除受二次确认保护。
    AC2: Given isSecret=true, When 再次查看, Then 仅展示掩码；仅在创建/更新提交时接受明文。
    AC3: Given 有人修改变量, When 查看历史, Then 能看到创建者/更新者与时间戳(creator/updater 字段)。

功能点 [34]: 管理后台 — 速率限制与封禁管理
  作为 管理员,
  我想要 查看/搜索被限流与被封禁的 IP 并进行手动封禁/解封,
  以便于 迅速处置异常流量。
  验收标准 (AC):
    AC1: Given 管理员身份, When 查询列表, Then 返回 IP/封禁等级/原因/过期时间/最近请求数等信息(来自 IPRateLimitManager 与缓存层)。
    AC2: Given 选择某 IP 并点击封禁, When 提交封禁等级与时长, Then 立即生效且新请求返回 403 并包含 banInfo。
    AC3: Given 选择某 IP 并点击解封, When 确认操作, Then 立刻恢复访问配额并移除 banInfo。

功能点 [35]: 管理后台 — 缓存管理(L1/L2)
  作为 管理员,
  我想要 按标签(tag)或键(key)清理 L1/L2 缓存并查看命中率,
  以便于 在排障与灰度时精准刷新缓存。
  验收标准 (AC):
    AC1: Given 选择缓存层与标签, When 执行清理, Then 返回受影响键数量与耗时；支持 dry-run 预览。
    AC2: Given 执行清理, When 查看操作记录, Then 可见操作者/时间/范围/统计；非法标签返回 400。
    AC3: Given 高并发清理, When 执行, Then 采用幂等策略避免重复删除并限制单次扫描上限。

功能点 [36]: 管理后台 — 审计日志与 API/性能日志
  作为 管理员,
  我想要 按用户/时间/严重级别筛选审计与性能日志并导出,
  以便于 追踪关键操作与性能问题。
  验收标准 (AC):
    AC1: Given 设定过滤条件, When 查询审计日志(AuditLog)与 API 日志(ApiPerformanceLog/ApiUsage), Then 返回分页结果与概要统计。
    AC2: Given 选中导出, When 执行导出, Then 生成 CSV/XLSX 文件并包含筛选条件快照。
    AC3: Given 数据量大, When 查询, Then 采用时间区间强制限制与索引命中, 响应时间满足 P95 < 2s。

功能点 [37]: 管理后台 — 支付提供商与健康检查
  作为 管理员,
  我想要 管理支付提供商配置并校验连通性,
  以便于 确保计费链路健康。
  验收标准 (AC):
    AC1: Given 管理员身份, When GET/POST/PUT /ops/api/v1/console/payment-providers, Then 可查询与更新配置；敏感字段掩码返回。
    AC2: Given 点击健康检查, When 调用 /ops/api/v1/console/payment-providers/health-check, Then 返回各提供商连通性/延迟/错误详情。
    AC3: Given 非管理员, When 访问上述接口, Then 返回 403。

功能点 [38]: 管理后台 — Token 规则热加载与试算
  作为 管理员,
  我想要 修改 Token 计费/折扣规则并在线热加载与试算,
  以便于 快速验证策略影响。
  验收标准 (AC):
    AC1: Given 管理员身份, When POST /ops/api/v1/console/token/rules/hot-reload, Then 返回 {success:true} 且新规则立即生效。
    AC2: Given 管理员身份, When POST /ops/api/v1/console/tokens/calculate 含示例 payload, Then 返回计算明细与总消耗并与预期匹配；非法 payload 返回 400。
    AC3: Given 非管理员, When 调用上述接口, Then 返回 403。

功能点 [39]: 管理后台 — 系统监控与健康配置
  作为 管理员,
  我想要 查看健康概览并在线调整监控开关/阈值,
  以便于 在不重启的情况下优化告警噪音与开销。
  验收标准 (AC):
    AC1: Given 管理员身份, When GET /ops/api/v1/console/monitoring/health, Then 返回 CPU/内存/请求量/错误率等基础指标与最近窗口统计。
    AC2: Given 管理员身份, When GET/PUT /ops/api/v1/console/monitoring/config, Then 可查看/更新监控采样间隔、慢请求阈值、日志级别等配置并即时生效。
    AC3: Given 非管理员, When 访问上述接口, Then 返回 403。
