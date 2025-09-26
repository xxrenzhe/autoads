项目重构指令
1.使用中文进行沟通和文档输出
2.请自行访问GCP和Firebase并修改更新，访问方式见secrets目录下的json密钥文件
3.优先访问Secret Manager，获得所有的环境变量
4.若遇到不清楚的地方，或需要申请网络访问权限的，请向我申请
5.完成阶段性的功能迭代后，及时进行功能测试，确保功能正常，且符合预期
6.完成阶段性的功能迭代后，及时编译对应服务镜像，确保构建成功
7.完成阶段性的功能迭代后，及时更新进展文档，只标注完成状态，不要修改任务内容，也可以根据需要补充新的任务
8.发布相关的配置请放置在deployments目录下
9.secrets目录和其下的所有文件都不能上传Github，也不能打包进入镜像
10.执行过程中生成的文档请放置在.kiro/specs/addictive-ads-management-system/目录下
11.请自行完成各种GCP和Firebase操作，若缺少权限，请说明并申请

重要信息：
1.GCP服务账号：codex-dev@gen-lang-client-0944935873.iam.gserviceaccount.com
2.Firebase服务账号：firebase-adminsdk-fbsvc@gen-lang-client-0944935873.iam.gserviceaccount.com
3.Firebase项目ID：gen-lang-client-0944935873，Firestore数据库：firestoredb
4.GCP Project ID：gen-lang-client-0944935873
5.Cloud SQL for PostgreSQL数据库：数据库实例autoads，数据库autoads_db，通过VPC Connector（cr-conn-default-ane1）进行内网访问数据库
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
10.代理IP服务商，初始配置美国代理IP服务商：Proxy_URL_US="https://api.iprocket.io/api?username=com49692430&password=Qxi9V59e3kNOW6pnRi3i&cc=ROW&ips=1&type=-res-&proxyType=http&responseType=txt"
11.技术栈
- 前端: Next.js，部署于Firebase Hosting
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