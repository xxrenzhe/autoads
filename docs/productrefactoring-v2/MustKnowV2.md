项目重构指令
1.使用中文进行沟通和文档输出
2.仔细阅读 docs/ProductRefactoring.md 和 docs/productrefactoring-v2 目录下的所有文档
3.请自行访问GCP和Firebase并修改更新，访问方式见secrets目录下的json密钥文件
4.优先访问Secret Manager，获得所有的环境变量
5.若遇到不清楚的地方，或需要申请网络访问权限的，请向我申请
6.完成阶段性的功能迭代后，及时进行功能测试，确保功能正常，且符合预期
7.完成阶段性的功能迭代后，及时编译对应服务镜像，确保构建成功
8.完成阶段性的功能迭代后，及时更新进展文档，保存进展
9.docs/productrefactoring-v2只是项目重构方案文档目录，服务代码需要放在 services 目录下

重要信息：
1.GCP服务账号：codex-dev@gen-lang-client-0944935873.iam.gserviceaccount.com
2.Firebase服务账号：firebase-adminsdk-fbsvc@gen-lang-client-0944935873.iam.gserviceaccount.com
3.GCP Project ID：gen-lang-client-0944935873
4.Cloud SQL数据库：数据库实例autoads，数据库autoads_db，通过VPC Connector进行内网访问数据库
5.前端: Next.js，部署于Firebase Hosting; 后端: Go微服务，部署于Google Cloud Run
6.Firebase Hosting 和 Cloud Run 都部署在 asia-northeast1 地区
7.技术栈
- 前端: Next.js，部署于Firebase Hosting
- 后端: Go微服务，部署于Google Cloud Run
- 认证: Firebase Authentication
- 配置与缓存: Firestore
- 事件总线: Google Cloud Pub/Sub
- 数据库：Google Cloud SQL
- API网关：Google Cloud API Gateway
- 异步工作单元/投影器：Google Cloud Functions
- 镜像仓库：Google Cloud Artifact Registry （代码库：autoads-services）
- AI能力接入：Firebase AI Logic