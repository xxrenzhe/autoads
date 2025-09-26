项目重构指令
1.使用中文进行沟通和文档输出
2.仔细阅读 docs/ProductRefactoring.md 和 docs/productrefactoring-v2 目录下的所有文档
3.请自行访问GCP和Firebase并修改更新，访问方式见secrets目录下的json密钥文件
4.优先访问Secret Manager，获得所有的环境变量
5.若遇到不清楚的地方，或需要申请网络访问权限的，请向我申请
6.完成阶段性的功能迭代后，及时进行功能测试，确保功能正常，且符合预期
7.完成阶段性的功能迭代后，及时编译对应服务镜像，确保构建成功
8.完成阶段性的功能迭代后，及时更新进展文档，保存进展
9.docs/productrefactoring-v2只是项目重构方案文档目录，不参与发布，且服务代码需要放在 services 目录下
10.secrets目录和其下的所有文件都不能上传Github，也不能打包进入镜像
11.请自行完成各种GCP和Firebase操作，若缺少权限，请说明并申请
12.在确保实现业务需求的情况下，功能实现遵循KISS原则，优先实现核心业务逻辑，确保前后端用户体验顺畅

重要信息：
1.GCP服务账号：codex-dev@gen-lang-client-0944935873.iam.gserviceaccount.com
2.Firebase服务账号：firebase-adminsdk-fbsvc@gen-lang-client-0944935873.iam.gserviceaccount.com
3.Firebase项目ID：gen-lang-client-0944935873，Firestore数据库：firestoredb
4.GCP Project ID：gen-lang-client-0944935873
5.Cloud SQL数据库：数据库实例autoads，数据库autoads_db，通过VPC Connector进行内网访问数据库
6.前端: Next.js，部署于Firebase Hosting; 后端: Go微服务，部署于Google Cloud Run
7.Firebase Hosting 和 Cloud Run 都部署在 asia-northeast1 地区
8.域名
- 预发环境：https://www.urlchecker.dev
- 生产环境：https://www.autoads.dev
9.代码分支和部署流程
部署流程主要分两步，第一步：推送代码到Github；第二步，触发Github Actions，通过Cloud Build生成不同环境的镜像并部署到Cloud Run
- 代码推送到main分支，触发preview环境Cloud Build镜像构建和Cloud Run部署：标注 docker image tag 为 preview-latest 和 preview-[commitid]
- 代码推送到production分支，触发production环境Cloud Build镜像构建和Cloud Run部署：标注 docker image tag 为 prod-latest 和 prod-[commitid]
- 当production分支打了tag（如v3.0.0），触发production环境Cloud Build镜像构建和Cloud Run部署：标注 docker image tag 为 prod-[tag] 和 和 prod-[commitid]
10.技术栈
- 用户前端(Next.js + Tailwind CSS)，部署于Firebase Hosting
- 后台前管理系统前端(Next.js + Ant Design)
- 后端: Go微服务，部署于Google Cloud Run
- 认证: Firebase Authentication
- 配置与缓存: Firestore
- 事件总线: Google Cloud Pub/Sub
- 数据库：Google Cloud SQL for PostgreSQL
- API网关：Google Cloud API Gateway
- 异步工作单元：Google Cloud Functions
- 镜像仓库：Google Cloud Artifact Registry （代码库：autoads-services）
- AI能力接入：Firebase AI Logic
- 敏感信息管理：Google Cloud Secret Manager
- 监控&日志：Google Cloud Monitoring & Logging
- 定时任务调度：Google Cloud Scheduler
- 数据仓库/分析：BigQuery